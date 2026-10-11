/// <reference lib="webworker" />
/**
 * On-device speech recognition with OpenAI's Whisper, running in a web worker
 * through transformers.js (ONNX Runtime, WebAssembly). The model downloads once
 * from Hugging Face and is cached by the browser; audio never leaves the device.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

type Device = "webgpu" | "wasm";
type DType = "fp32" | "fp16" | "q8" | "q4";
export interface WhisperRuntime {
  device: Device | Record<string, Device>;
  dtype: DType | Record<string, DType>;
}

export type WhisperRequest =
  | { type: "load"; model: string; runtime?: WhisperRuntime }
  | { type: "transcribe"; id: number; audio: Float32Array };

export type WhisperResponse =
  | { type: "progress"; progress: number; loaded: number; total: number }
  | { type: "ready"; model: string; runtime: string }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; message: string };

env.allowLocalModels = false;
env.useBrowserCache = true;
// Import the ONNX Runtime WASM factory straight from jsDelivr instead of re-wrapping
// it in a blob: URL, which the Content Security Policy (rightly) does not allow.
env.useWasmCache = false;
// With cross-origin isolation (set on the interview page) WebAssembly can use several threads.
if (self.crossOriginIsolated && env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
}

let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let loadedModel: string | null = null;

const post = (message: WhisperResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);

/**
 * The audio encoder is the expensive part, so it runs on the GPU (WebGPU) when
 * one is available; the small token decoder stays on the CPU with 8-bit weights.
 * Without WebGPU everything runs as 8-bit WebAssembly.
 */
async function pickRuntime(): Promise<WhisperRuntime> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (gpu && (await gpu.requestAdapter())) {
      return { device: { encoder_model: "webgpu", decoder_model_merged: "wasm" }, dtype: { encoder_model: "fp32", decoder_model_merged: "q8" } };
    }
  } catch {
    /* no usable GPU */
  }
  return { device: "wasm", dtype: "q8" };
}

function load(model: string, requested?: WhisperRuntime): Promise<AutomaticSpeechRecognitionPipeline> {
  if (loading && loadedModel === model) return loading;
  loadedModel = model;
  let runtimeLabel = "";
  loading = (async () => {
    const runtime = requested ?? (await pickRuntime());
    runtimeLabel = JSON.stringify(runtime);
    return pipeline("automatic-speech-recognition", model, {
    device: runtime.device,
    dtype: runtime.dtype,
    progress_callback: (info) => {
      if (info.status === "progress_total") {
        post({ type: "progress", progress: Math.round(info.progress), loaded: info.loaded, total: info.total });
      }
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;
  })().then((p) => {
    post({ type: "ready", model, runtime: runtimeLabel });
    return p;
  });
  loading.catch((error: unknown) => {
    loading = null;
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  });
  return loading;
}

/** ONNX sessions can't run concurrently, so transcription requests are processed one at a time. */
let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<WhisperRequest>) => {
  const msg = event.data;
  if (msg.type === "load") {
    void load(msg.model, msg.runtime).catch(() => undefined);
    return;
  }
  queue = queue.then(() => transcribe(msg));
};

async function transcribe(msg: Extract<WhisperRequest, { type: "transcribe" }>) {
  try {
    if (!loading || !loadedModel) throw new Error("Model not loaded");
    const transcriber = await loading;
    const output = await transcriber(msg.audio, {
      // Whisper reads 30-second windows; overlapping strides stitch long answers together.
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const text = (Array.isArray(output) ? output[0]?.text : output.text) ?? "";
    post({ type: "result", id: msg.id, text: text.trim() });
  } catch (error) {
    post({ type: "error", id: msg.id, message: error instanceof Error ? error.message : String(error) });
  }
}
