"""
Hand Raise AI Engine — decides whether an AI participant should raise hand.
Two-stage logic: probability gate + LLM reasoning.
"""

import random
from typing import List, Dict


class HandRaiseAI:
    """
    Hand Raise Engine — Part of the GD system.

    Responsibilities:
    - Evaluate discussion context for each AI participant
    - Use personality + probability to decide RAISE_HAND vs WAIT
    - Call LLM for intelligent decision-making
    """

    def __init__(self, gemini_api_key: str):
        self.api_key = gemini_api_key

    async def decide(
        self,
        ai_name: str,
        personality: str,
        topic: str,
        previous_speakers: List[Dict],
        speaking_count: int = 0,
        raise_probability: float = 0.5,
    ) -> str:
        """
        Returns "RAISE_HAND" or "WAIT".

        Args:
            ai_name:           Display name of the AI candidate
            personality:       Personality description string
            topic:             Current GD topic/question
            previous_speakers: List of {"name": str, "snippet": str} dicts
            speaking_count:    How many times this AI has spoken so far
            raise_probability: Base probability (0.0–1.0) for this AI's eagerness
        """
        # Reduce probability if AI has already spoken a lot
        adjusted = max(0.1, raise_probability - speaking_count * 0.15)

        # Fast probability gate — avoids LLM call for clear WAIT cases
        if random.random() > adjusted * 1.4:
            return "WAIT"

        try:
            from ._gemini import call_gemini
            prev_context = "\n".join(
                f'{s["name"]}: "{s["snippet"]}"' for s in (previous_speakers or [])[-4:]
            ) or "None yet"

            prompt = f"""You are {ai_name}, an AI candidate in a group discussion interview.

Personality: {personality}
Discussion question: "{topic}"

Previous speakers:
{prev_context}

Your speaking count so far: {speaking_count}

Rules:
- Raise hand if you have a strong, unique point not yet covered
- If someone already said your main point, wait
- If speaking_count >= 3, be very selective

Respond with ONLY one word — RAISE_HAND or WAIT"""

            result = await call_gemini(self.api_key, prompt, temperature=0.4, max_tokens=8)
            return "RAISE_HAND" if "RAISE_HAND" in (result or "") else "WAIT"
        except Exception:
            # Fallback to pure probability
            return "RAISE_HAND" if random.random() < adjusted else "WAIT"
