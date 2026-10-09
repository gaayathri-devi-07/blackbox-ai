"""
Shared Gemini API helper for all GD engines.
"""

import httpx


async def call_gemini(
    api_key: str,
    prompt: str,
    temperature: float = 0.85,
    max_tokens: int = 160,
) -> str:
    """Calls Gemini 2.5 Flash and returns the text response."""
    if not api_key:
        return ""

    # UPDATED: Changed to stable gemini-2.5-flash model with v1 endpoint
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(url, json=payload)
        res.raise_for_status()
        data = res.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()