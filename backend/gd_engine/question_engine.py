"""
Question Engine — selects or generates GD topics.
"""

import random
from typing import Optional


GD_TOPICS = {
    "technology": [
        "Is Artificial Intelligence a threat or an opportunity for the future workforce?",
        "Should social media platforms be regulated by governments?",
        "Is online education as effective as traditional classroom learning?",
        "Should AI be used in hiring and performance evaluations?",
        "Is technology making us more connected but less social?",
    ],
    "society": [
        "Should college education be free for everyone?",
        "Is work-life balance a myth in today's competitive world?",
        "Climate change: Individual responsibility vs corporate accountability",
        "Should the voting age be lowered to 16?",
        "Is social media doing more harm than good to society?",
    ],
    "business": [
        "Remote work vs office work — what is the future of corporate culture?",
        "Is entrepreneurship better than a corporate career for the youth?",
        "Are start-ups overvalued in today's economy?",
        "Should companies prioritise profit over social responsibility?",
        "Is the gig economy good or bad for workers?",
    ],
}

ALL_TOPICS = [t for topics in GD_TOPICS.values() for t in topics]


class QuestionEngine:
    """
    Question Engine — Part of the GD system.

    Responsibilities:
    - Select random or category-specific GD topics
    - Generate follow-up questions based on ongoing discussion (LLM-powered)
    """

    def __init__(self, gemini_api_key: str):
        self.api_key = gemini_api_key

    async def get_topic(self, category: Optional[str] = None) -> str:
        """Return a random GD topic, optionally filtered by category."""
        if category and category in GD_TOPICS:
            return random.choice(GD_TOPICS[category])
        return random.choice(ALL_TOPICS)

    async def get_follow_up(self, topic: str, conversation_summary: str) -> str:
        """Generate a follow-up question using the LLM."""
        from ._gemini import call_gemini  # lazy import to avoid circular deps
        prompt = (
            f'You are a GD moderator. The group has been discussing: "{topic}".\n'
            f"Summary so far: {conversation_summary[:400]}\n\n"
            "Ask a 1-sentence follow-up question that deepens the discussion or explores a new angle."
        )
        result = await call_gemini(self.api_key, prompt, temperature=0.7, max_tokens=80)
        return result or f"Let us now explore: what are the long-term implications of {topic.lower()}?"
