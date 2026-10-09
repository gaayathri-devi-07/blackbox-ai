
"""
Conversation Engine — generates AI candidate answers for the GD.
Uses personality-aware LLM prompts to produce realistic, varied responses.
"""

from typing import List, Dict


class ConversationEngine:
    """
    Conversation Engine — Part of the GD system.

    Responsibilities:
    - Generate a personality-consistent discussion answer
    - Consider conversation history to avoid repetition
    - Enforce length and professional tone rules
    """

    def __init__(self, gemini_api_key: str):
        self.api_key = gemini_api_key

    FALLBACK_ANSWERS = [
        "From my perspective, this topic has multiple dimensions that we should consider carefully before drawing any conclusions.",
        "I believe there are both opportunities and challenges here that require a balanced, evidence-based approach.",
        "Building on the points raised, I think the key factor we need to focus on is the long-term societal impact.",
    ]

    async def generate(
        self,
        ai_name: str,
        personality: str,
        topic: str,
        conversation_history: List[Dict],
    ) -> str:
        """
        Generate a 2–3 sentence discussion answer.

        Args:
            ai_name:              Display name of the AI candidate
            personality:          Personality description string
            topic:                Current GD topic/question
            conversation_history: List of {"speakerName": str, "text": str} dicts
        """
        try:
            from ._gemini import call_gemini

            history_context = "\n".join(
                f'{m["speakerName"]}: {m["text"]}' for m in (conversation_history or [])[-5:]
            ) or "(You are speaking first on this topic)"

            prompt = f"""You are {ai_name}, an AI candidate in a group discussion interview.

Personality: {personality}

Topic: "{topic}"

Recent conversation:
{history_context}

Rules:
- Speak 2-3 sentences only
- Be professional and confident
- Build on, agree with, or respectfully challenge previous points
- Stay true to your personality
- Do NOT use asterisks, markdown formatting, or quotation marks around your response

Give your response now:"""

            result = await call_gemini(self.api_key, prompt, temperature=0.88, max_tokens=160)
            return result or self.FALLBACK_ANSWERS[0]
        except Exception:
            import random
            return random.choice(self.FALLBACK_ANSWERS)
