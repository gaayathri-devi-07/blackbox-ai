"""
Moderator Engine — generates professional moderator dialogue for the GD.
Handles introductions, speaker selection, encouragement, follow-ups, and wrap-ups.
"""

from typing import Optional


class ModeratorEngine:
    """
    Moderator Engine — Part of the GD system.

    Responsibilities:
    - Introduce discussion topics
    - Invite participants to speak
    - Encourage quieter candidates
    - Ask follow-up questions to deepen discussion
    - Wrap up the discussion professionally
    """

    def __init__(self, gemini_api_key: str):
        self.api_key = gemini_api_key

    FALLBACK_SPEECHES = {
        "introduce": "Welcome everyone. Today we will be discussing an important and timely topic. Please share your thoughts freely and professionally.",
        "select_speaker": "Thank you. Please go ahead with your thoughts.",
        "encourage_silent": "We haven't heard from you yet. Would you like to share your perspective on this topic?",
        "follow_up": "Interesting perspectives. Let us now explore a related angle — what are the long-term implications of this?",
        "wrap_up": "Thank you all for an insightful discussion. The diverse perspectives shared today reflect the complexity of this topic.",
    }

    PROMPTS = {
        "introduce": (
            'You are a professional GD moderator. In 2 sentences, introduce this discussion topic '
            'engagingly and neutrally: "{topic}". Then invite participants to share their thoughts.'
        ),
        "select_speaker": (
            'You are a GD moderator. In exactly 1 sentence, invite {target} to share their thoughts '
            'on "{topic}". Be professional and encouraging.'
        ),
        "encourage_silent": (
            'You are a GD moderator. {target} has not yet spoken. In 1 sentence, gently invite '
            'them to share their perspective on "{topic}".'
        ),
        "follow_up": (
            'You are a GD moderator. The group has been discussing "{topic}". '
            'Ask a 1-sentence follow-up question that deepens the discussion or explores a different angle.'
        ),
        "wrap_up": (
            'You are a GD moderator. Wrap up the group discussion on "{topic}" in 2 professional sentences. '
            'Thank participants and give a brief, neutral closing remark.'
        ),
    }

    async def speak(
        self,
        situation: str,
        topic: str,
        target_participant: Optional[str] = None,
    ) -> str:
        """
        Generate moderator dialogue for the given situation.

        Args:
            situation:         One of introduce | select_speaker | encourage_silent | follow_up | wrap_up
            topic:             Current GD topic
            target_participant: Name of the participant to address (for select_speaker, encourage_silent)
        """
        if situation not in self.PROMPTS:
            return self.FALLBACK_SPEECHES.get("introduce", "")

        try:
            from ._gemini import call_gemini
            target = target_participant or "the next participant"
            prompt = self.PROMPTS[situation].format(topic=topic, target=target)
            result = await call_gemini(self.api_key, prompt, temperature=0.7, max_tokens=110)
            return result or self.FALLBACK_SPEECHES.get(situation, "")
        except Exception:
            return self.FALLBACK_SPEECHES.get(situation, "")
