import re
from typing import Tuple, Optional


class DCB0129SafetyGuardrail:
    """
    NHS Clinical Risk Management (DCB0129) deterministic safety interceptor.
    Bypasses generative models if red-flag emergency symptoms are matched.
    """
    EMERGENCY_TRIGGERS = {
        "CARDIAC_ISCHEMIA": [
            r"\b(chest\s*(pain|tightness|pressure|heavy|discomfort))\b",
            r"\b(pain\s*radiating\s*(to|down)\s*(my\s*)?(left\s*arm|jaw|neck))\b"
        ],
        "STROKE_FAST": [
            r"\b(face\s*is\s*(drooping|numb|fallen))\b",
            r"\b(slurred\s*speech|cannot\s*speak\s*properly|words\s*are\s*jumbled)\b",
            r"\b(weakness\s*in\s*(one|my)\s*arm|cannot\s*raise\s*arm)\b"
        ],
        "SEVERE_RESPIRATORY": [
            r"\b(cannot\s*breathe|struggling\s*for\s*(air|breath)|lips\s*turning\s*blue)\b",
            r"\b(gasping\s*for\s*breath|severe\s*asthma\s*attack)\b"
        ],
        "ANAPHYLAXIS": [
            r"\b(throat\s*is\s*closing|lips\s*swelling|tongue\s*swelling)\b"
        ]
    }

    @classmethod
    def evaluate(cls, transcript: str) -> Tuple[bool, Optional[str], Optional[str]]:
        clean_text = transcript.lower().strip()

        for category, patterns in cls.EMERGENCY_TRIGGERS.items():
            for pattern in patterns:
                if re.search(pattern, clean_text):
                    emergency_script = (
                        "I am detecting symptoms that require immediate emergency medical care. "
                        "Please hang up and dial 999 immediately or attend your nearest Accident & Emergency (A&E) department."
                    )
                    return True, category, emergency_script

        return False, None, None
