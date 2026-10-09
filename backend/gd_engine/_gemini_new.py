"""
Shared Gemini API helper for all GD engines.
Updated to use gemini-2.5-flash with REST API.
"""

import os
import httpx


async def call_gemini(
    api_key: str,
    prompt: str,
    temperature: float = 0.85,
    max_tokens: int = 160,
) -> str:
    """
    Calls Gemini 2.5 Flash and returns the text response.
    Uses v1 API endpoint (stable model).
    """
    if not api_key:
        print("WARNING: GEMINI_API_KEY not provided")
        return ""
    
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature
        },
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=payload)
            res.raise_for_status()
            data = res.json()
            
            if "candidates" in data and len(data["candidates"]) > 0:
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return text.strip()
            else:
                print(f"Gemini API Warning: No candidates in response: {data}")
                return ""
    
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return ""
