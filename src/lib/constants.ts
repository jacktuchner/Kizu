export const PROCEDURE_TYPES = [
  "ACL Reconstruction",
  "Ankle Reconstruction",
  "Carpal Tunnel Release",
  "Gallbladder Removal",
  "Hernia Repair",
  "Hysterectomy",
  "Laminectomy",
  "Meniscus Repair",
  "Rotator Cuff Repair",
  "Shoulder Labrum Repair",
  "Spinal Fusion",
  "Total Hip Replacement",
  "Total Knee Replacement",
  "Total Shoulder Replacement",
] as const;

export const PROCEDURE_DETAILS: Record<string, string[]> = {
  "ACL Reconstruction": [
    "Patellar tendon autograft",
    "Hamstring tendon autograft",
    "Quadriceps tendon autograft",
    "Allograft",
  ],
  "Total Hip Replacement": [
    "Anterior approach",
    "Posterior approach",
    "Lateral approach",
    "Revision surgery",
  ],
  "Spinal Fusion": [
    "Lumbar (L4-L5)",
    "Lumbar (L5-S1)",
    "Cervical",
    "Multi-level",
  ],
  "Laminectomy": [
    "Lumbar (lower back)",
    "Cervical (neck)",
    "Thoracic (mid-back)",
  ],
  "Total Shoulder Replacement": [
    "Total shoulder replacement",
    "Reverse shoulder replacement",
    "Partial shoulder replacement",
  ],
  "Gallbladder Removal": [
    "Laparoscopic",
    "Open surgery",
  ],
  "Hysterectomy": [
    "Laparoscopic",
    "Abdominal",
    "Vaginal",
    "Robotic-assisted",
  ],
};

export const AGE_RANGES = [
  "Teens",
  "20s",
  "30s",
  "40s",
  "50s",
  "60s",
  "70s+",
] as const;

export const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

export const ACTIVITY_LEVELS = [
  { value: "SEDENTARY", label: "Sedentary", description: "Mostly desk work, minimal exercise" },
  { value: "LIGHTLY_ACTIVE", label: "Lightly Active", description: "Light walking, gentle yoga, basic daily activities" },
  { value: "MODERATELY_ACTIVE", label: "Moderately Active", description: "Exercise 2-3x/week (gym, swimming, hiking)" },
  { value: "ACTIVE", label: "Active", description: "Regular exercise 4-5x/week" },
  { value: "ATHLETE", label: "Athlete", description: "Training/competition is a major life focus" },
] as const;

export const RECOVERY_GOALS = [
  "Return to competitive sport",
  "Return to recreational activity",
  "Pain-free daily living",
  "Return to manual labor job",
  "Return to desk job",
  "Play with kids/grandkids",
  "Travel comfortably",
  "Independent living",
  "Return to sexual activity",
] as const;

export const COMPLICATING_FACTORS = [
  "Revision surgery",
  "Bilateral procedure",
  "Previous injuries to same area",
  "Diabetes",
  "Obesity",
  "Osteoporosis",
  "Autoimmune condition",
  "Blood clotting disorder",
] as const;

export const LIFESTYLE_CONTEXTS = [
  "Parent of young kids",
  "Lives alone",
  "Works from home",
  "Physical/manual job",
  "Office/desk job",
  "Caregiver for others",
  "Limited home support",
  "Multi-story home",
  "No car/limited transportation",
] as const;

export const TIME_SINCE_SURGERY = [
  "Less than 1 month",
  "1-3 months",
  "3-6 months",
  "6-12 months",
  "1-2 years",
  "2+ years",
] as const;

export const RECORDING_CATEGORIES = [
  { value: "WEEKLY_TIMELINE", label: "Week-by-Week Timeline", description: "What to expect each week of recovery" },
  { value: "WISH_I_KNEW", label: "Things I Wish I Knew", description: "What you wish someone told you before surgery" },
  { value: "PRACTICAL_TIPS", label: "Practical Tips", description: "Sleep positions, meal prep, mobility aids, clothing" },
  { value: "MENTAL_HEALTH", label: "Mental & Emotional Health", description: "Coping with recovery mentally and emotionally" },
  { value: "RETURN_TO_ACTIVITY", label: "Return to Activity", description: "Milestones, setbacks, and getting back to normal" },
  { value: "MISTAKES_AND_LESSONS", label: "Mistakes & Lessons", description: "What you would do differently knowing what you know now" },
] as const;

// Call buffer & cap
export const CALL_BUFFER_OPTIONS = [0, 15, 30, 45, 60] as const;
export const DEFAULT_BUFFER_MINUTES = 15;

export const PLATFORM_FEE_PERCENT = 25; // 25% platform commission on calls
export const DEFAULT_CALL_DURATION = 30; // minutes
export const MIN_CALL_RATE = 40;
export const MAX_CALL_RATE = 75;

// Group session pricing & limits
export const MIN_GROUP_SESSION_PRICE = 10;
export const MAX_GROUP_SESSION_PRICE = 35;
export const MIN_GROUP_CAPACITY = 4;
export const MAX_GROUP_CAPACITY = 20;
export const DEFAULT_MIN_ATTENDEES = 3;
export const GROUP_SESSION_DURATIONS = [45, 60, 90];
export const GROUP_SESSION_CANCEL_HOURS_BEFORE = 4;

// Recommendation categories & pricing
export const RECOMMENDATION_CATEGORIES = [
  { value: "RECOVERY_PRODUCT", label: "Recovery Product", description: "Slings, braces, ice machines, compression gear" },
  { value: "PT_PROVIDER", label: "Physical Therapist", description: "Physical therapist or PT clinic" },
  { value: "MASSAGE_THERAPY", label: "Massage Therapist", description: "Massage therapist or bodywork provider" },
  { value: "MEDICAL_PROVIDER", label: "Medical Provider", description: "Doctor, surgeon, or clinic" },
  { value: "APP_OR_TOOL", label: "App or Tool", description: "Recovery apps, trackers, online tools" },
  { value: "BOOK_OR_RESOURCE", label: "Book or Resource", description: "Books, websites, videos" },
  { value: "OTHER", label: "Other", description: "Anything else helpful for recovery" },
] as const;

export const RECOMMENDATION_PRICE_RANGES = [
  { value: "FREE", label: "Free" },
  { value: "$", label: "$ (Under $25)" },
  { value: "$$", label: "$$ ($25-$100)" },
  { value: "$$$", label: "$$$ ($100+)" },
] as const;

export const LOCATION_BASED_CATEGORIES = ["PT_PROVIDER", "MASSAGE_THERAPY", "MEDICAL_PROVIDER"] as const;


// ─── Guide Vetting ───

export const GUIDE_STATUSES = {
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

// ─── Condition Categories ───

export const CONDITION_CATEGORIES = [
  { value: "SURGERY", label: "Surgery Recovery" },
  { value: "CHRONIC_PAIN", label: "Autoimmune" },
] as const;

export const CHRONIC_PAIN_CONDITIONS = [
  "Celiac Disease",
  "Fibromyalgia",
  "Graves' Disease",
  "Hashimoto's Thyroiditis",
  "Inflammatory Bowel Disease (Crohn's & Colitis)",
  "Lupus (SLE)",
  "Multiple Sclerosis",
  "Psoriasis / Psoriatic Arthritis",
  "Rheumatoid Arthritis",
  "Sjögren's Syndrome",
  "Tinnitus",
  "Type 1 Diabetes",
] as const;

export const CHRONIC_PAIN_DETAILS: Record<string, string[]> = {
  "Tinnitus": [
    "Subjective (only you hear it)",
    "Objective (others can detect it)",
    "Pulsatile (rhythmic / heartbeat-like)",
    "Noise-induced",
  ],
  "Hashimoto's Thyroiditis": [
    "Hypothyroid (underactive)",
    "Hashitoxicosis (temporary hyperthyroid)",
    "With goiter",
    "Post-thyroidectomy",
  ],
  "Type 1 Diabetes": [
    "Insulin pump user",
    "Multiple daily injections (MDI)",
    "CGM (continuous glucose monitor)",
    "Late-onset / LADA",
  ],
  "Lupus (SLE)": [
    "Skin & joint dominant",
    "Kidney involvement (lupus nephritis)",
    "CNS / neuropsychiatric lupus",
    "Mild / limited disease",
  ],
  "Celiac Disease": [
    "Classic GI symptoms",
    "Non-classic / silent celiac",
    "Refractory celiac",
    "Dermatitis herpetiformis",
  ],
  "Sjögren's Syndrome": [
    "Primary (standalone)",
    "Secondary (with another autoimmune)",
    "Dry eyes dominant",
    "Dry mouth dominant",
  ],
  "Psoriasis / Psoriatic Arthritis": [
    "Plaque psoriasis",
    "Psoriatic arthritis (joints)",
    "Guttate psoriasis",
    "Scalp / nail involvement",
  ],
  "Rheumatoid Arthritis": [
    "Seropositive",
    "Seronegative",
    "Early-stage",
    "Advanced/erosive",
  ],
  "Multiple Sclerosis": [
    "Relapsing-remitting (RRMS)",
    "Secondary progressive (SPMS)",
    "Primary progressive (PPMS)",
    "Clinically isolated syndrome (CIS)",
  ],
  "Inflammatory Bowel Disease (Crohn's & Colitis)": [
    "Crohn's disease",
    "Ulcerative colitis",
    "Indeterminate colitis",
    "Post-surgical / ostomy",
  ],
  "Graves' Disease": [
    "Hyperthyroid (overactive)",
    "Graves' eye disease (TED)",
    "Post-RAI / post-thyroidectomy",
    "In remission on medication",
  ],
  "Fibromyalgia": [
    "Widespread pain dominant",
    "Fibro fog / cognitive issues",
    "Fatigue dominant",
    "IBS co-occurrence",
  ],
};

export const TIME_SINCE_DIAGNOSIS = [
  "Less than 6 months",
  "6-12 months",
  "1-2 years",
  "2-5 years",
  "5-10 years",
  "10+ years",
] as const;

export const CHRONIC_PAIN_GOALS = [
  "Manage symptoms effectively",
  "Reduce flare frequency",
  "Maintain energy levels",
  "Improve sleep quality",
  "Find effective treatments",
  "Maintain employment/career",
  "Improve mental health",
  "Better daily functioning",
  "Build a support system",
  "Reduce medication side effects",
] as const;

export const CHRONIC_PAIN_COMPLICATING_FACTORS = [
  "Multiple autoimmune conditions",
  "Anxiety or depression",
  "Medication sensitivity",
  "Fatigue / energy issues",
  "Dietary restrictions",
  "Brain fog / cognitive issues",
  "Limited mobility",
  "Undiagnosed for years",
] as const;

export const RECORDING_CATEGORIES_CHRONIC_PAIN = [
  { value: "WEEKLY_TIMELINE", label: "My Condition Journey", description: "Your story living with an autoimmune condition over time" },
  { value: "WISH_I_KNEW", label: "Things I Wish I Knew", description: "What you wish someone told you after diagnosis" },
  { value: "PRACTICAL_TIPS", label: "Daily Management Tips", description: "Pacing, routines, tools, and strategies that help" },
  { value: "MENTAL_HEALTH", label: "Mental & Emotional Health", description: "Coping mentally and emotionally with your condition" },
  { value: "RETURN_TO_ACTIVITY", label: "Activity & Pacing", description: "Staying active, pacing strategies, and setbacks" },
  { value: "MISTAKES_AND_LESSONS", label: "Mistakes & Lessons", description: "What you would do differently knowing what you know now" },
] as const;

export const JOURNAL_MILESTONE_PRESETS_CHRONIC_PAIN = [
  "Low-symptom day", "Exercised without a flare", "Slept through the night",
  "Reduced medication", "Worked a full day", "Tried a new treatment",
  "Cooked a meal", "Went for a walk", "Socialized without crashing",
  "Found a trigger food",
] as const;

export const JOURNAL_TRIGGER_PRESETS = [
  "Weather change", "Poor sleep", "Stress", "Overexertion",
  "Gluten/dairy", "Hormonal cycle", "Travel", "Sitting too long",
  "Infection/illness", "Emotional upset",
] as const;

// ─── Community Forum ───

export const FORUM_THREAD_TYPES = [
  { value: "DISCUSSION", label: "Discussion" },
  { value: "QUESTION", label: "Question" },
  { value: "EXPERIENCE", label: "Experience" },
  { value: "TIP", label: "Tip" },
] as const;

export const FORUM_PAGE_SIZE = 15;

// ─── Guide Agreement ───

export const GUIDE_AGREEMENT_VERSION = "2026-02-20-v3";

export const GUIDE_AGREEMENT_CLAUSES = [
  "All interactions with seekers must remain on the Kizu platform",
  "I will not share my personal contact information (phone, email, social media) with seekers",
  "I will not solicit or encourage seekers to communicate with me outside of Kizu",
  "I will not bypass the platform for payments or offer paid services outside Kizu",
  "I will not provide medical advice, diagnoses, or treatment recommendations",
  "I understand that violations may result in immediate termination and forfeiture of pending earnings",
] as const;

// ─── Helpers ───

export function isChronicPainCondition(conditionOrProcedure: string): boolean {
  return (CHRONIC_PAIN_CONDITIONS as readonly string[]).includes(conditionOrProcedure);
}

export function getRecordingCategoriesForCondition(conditionCategory: string) {
  return conditionCategory === "CHRONIC_PAIN" ? RECORDING_CATEGORIES_CHRONIC_PAIN : RECORDING_CATEGORIES;
}

export function getAllConditions(): { value: string; label: string; category: "SURGERY" | "CHRONIC_PAIN" }[] {
  const surgeries = PROCEDURE_TYPES.map((p) => ({ value: p, label: p, category: "SURGERY" as const }));
  const chronic = CHRONIC_PAIN_CONDITIONS.map((c) => ({ value: c, label: c, category: "CHRONIC_PAIN" as const }));
  return [...surgeries, ...chronic];
}

// ─── Recovery Journal ───

export const JOURNAL_MILESTONE_PRESETS = [
  "First time walking unassisted", "Drove a car", "Returned to work",
  "Slept through the night", "Went up stairs normally", "Stopped taking pain meds",
  "First workout/exercise", "Walked a mile", "Returned to sport", "Full range of motion",
] as const;
export const JOURNAL_MOOD_EMOJIS = ["\u{1F61E}", "\u{1F615}", "\u{1F610}", "\u{1F642}", "\u{1F604}"] as const;
export const JOURNAL_NUDGE_DAYS = 7;
