/** Shared design colors. Const maps stand in for enums (`erasableSyntaxOnly`). */

export const Palette = {
  Brown: "#c99589",
  BrownHover: "#b98579",
  Blue: "#4f91ba",
  Ink: "#3d5f7a",
  Text: "#2f2430",
  TextSecondary: "#574a55",
  TextMuted: "#7f7280",
} as const;
export type Palette = (typeof Palette)[keyof typeof Palette];

export const PageBg = {
  Start: "#eaf3fb",
  Mid: "#f5f3f8",
  End: "#f8ecef",
} as const;
export type PageBg = (typeof PageBg)[keyof typeof PageBg];

export const PAGE_GRADIENT_CSS = `linear-gradient(90deg, ${PageBg.Start} 0%, ${PageBg.Mid} 48%, ${PageBg.End} 100%)`;

export const ExposureGradient = {
  Pink: "#e8a0b0",
  Lilac: "#c7a0c8",
  Sky: "#7eb3d9",
  Blue: "#4f91ba",
} as const;
export type ExposureGradient = (typeof ExposureGradient)[keyof typeof ExposureGradient];

export const EXPOSURE_GRADIENT_CSS = `linear-gradient(90deg, ${ExposureGradient.Pink} 0%, ${ExposureGradient.Lilac} 42%, ${ExposureGradient.Sky} 78%, ${ExposureGradient.Blue} 100%)`;

/** Color families from the WEF 26-skill legend. */
export const SkillSwatch = {
  DarkBlue: "#1F4E79",
  MediumPurple: "#8B6B9E",
  LightLavender: "#D4C4E0",
  DarkPurple: "#5B4A8A",
  Gold: "#C4A35A",
  SkyBlue: "#7EC8E3",
  ForestGreen: "#6B8F71",
} as const;
export type SkillSwatch = (typeof SkillSwatch)[keyof typeof SkillSwatch];

export const WefSkillId = {
  AnalyticalThinking: 1,
  ResilienceFlexibilityAgility: 2,
  LeadershipAndSocialInfluence: 3,
  CreativeThinking: 4,
  MotivationAndSelfAwareness: 5,
  TechnologicalLiteracy: 6,
  EmpathyAndActiveListening: 7,
  CuriosityAndLifelongLearning: 8,
  TalentManagement: 9,
  ServiceOrientationAndCustomerService: 10,
  AiAndBigData: 11,
  SystemsThinking: 12,
  ResourceManagementAndOperations: 13,
  DependabilityAndAttentionToDetail: 14,
  QualityControl: 15,
  TeachingAndMentoring: 16,
  NetworksAndCybersecurity: 17,
  DesignAndUserExperience: 18,
  MultiLingualism: 19,
  MarketingAndMedia: 20,
  ReadingWritingAndMathematics: 21,
  EnvironmentalStewardship: 22,
  Programming: 23,
  ManualDexterityEnduranceAndPrecision: 24,
  GlobalCitizenship: 25,
  SensoryProcessingAbilities: 26,
} as const;
export type WefSkillId = (typeof WefSkillId)[keyof typeof WefSkillId];

export const SKILL_COLOR: Record<WefSkillId, SkillSwatch> = {
  [WefSkillId.AnalyticalThinking]: SkillSwatch.DarkBlue,
  [WefSkillId.ResilienceFlexibilityAgility]: SkillSwatch.MediumPurple,
  [WefSkillId.LeadershipAndSocialInfluence]: SkillSwatch.LightLavender,
  [WefSkillId.CreativeThinking]: SkillSwatch.DarkBlue,
  [WefSkillId.MotivationAndSelfAwareness]: SkillSwatch.MediumPurple,
  [WefSkillId.TechnologicalLiteracy]: SkillSwatch.DarkPurple,
  [WefSkillId.EmpathyAndActiveListening]: SkillSwatch.LightLavender,
  [WefSkillId.CuriosityAndLifelongLearning]: SkillSwatch.MediumPurple,
  [WefSkillId.TalentManagement]: SkillSwatch.Gold,
  [WefSkillId.ServiceOrientationAndCustomerService]: SkillSwatch.SkyBlue,
  [WefSkillId.AiAndBigData]: SkillSwatch.DarkPurple,
  [WefSkillId.SystemsThinking]: SkillSwatch.DarkBlue,
  [WefSkillId.ResourceManagementAndOperations]: SkillSwatch.Gold,
  [WefSkillId.DependabilityAndAttentionToDetail]: SkillSwatch.MediumPurple,
  [WefSkillId.QualityControl]: SkillSwatch.Gold,
  [WefSkillId.TeachingAndMentoring]: SkillSwatch.LightLavender,
  [WefSkillId.NetworksAndCybersecurity]: SkillSwatch.DarkPurple,
  [WefSkillId.DesignAndUserExperience]: SkillSwatch.DarkPurple,
  [WefSkillId.MultiLingualism]: SkillSwatch.DarkBlue,
  [WefSkillId.MarketingAndMedia]: SkillSwatch.SkyBlue,
  [WefSkillId.ReadingWritingAndMathematics]: SkillSwatch.DarkBlue,
  [WefSkillId.EnvironmentalStewardship]: SkillSwatch.SkyBlue,
  [WefSkillId.Programming]: SkillSwatch.DarkPurple,
  [WefSkillId.ManualDexterityEnduranceAndPrecision]: SkillSwatch.ForestGreen,
  [WefSkillId.GlobalCitizenship]: SkillSwatch.SkyBlue,
  [WefSkillId.SensoryProcessingAbilities]: SkillSwatch.ForestGreen,
};

export const SKILL_SWATCH_LABEL: Record<SkillSwatch, string> = {
  [SkillSwatch.DarkBlue]: "Cognitive",
  [SkillSwatch.MediumPurple]: "Self-efficacy",
  [SkillSwatch.LightLavender]: "Working with others",
  [SkillSwatch.DarkPurple]: "Technology",
  [SkillSwatch.Gold]: "Management",
  [SkillSwatch.SkyBlue]: "Engagement & ethics",
  [SkillSwatch.ForestGreen]: "Physical abilities",
};

/** Light fill + darker ink for skill titles/chips. */
export const SkillSwatchBg = {
  DarkBlue: "#D6E4F0",
  MediumPurple: "#EDE4F2",
  LightLavender: "#F3ECF7",
  DarkPurple: "#E4DEF0",
  Gold: "#F4E9D0",
  SkyBlue: "#DFF3F9",
  ForestGreen: "#DCE8DE",
} as const;
export type SkillSwatchBg = (typeof SkillSwatchBg)[keyof typeof SkillSwatchBg];

export const SkillSwatchInk = {
  DarkBlue: "#14324F",
  MediumPurple: "#5A3F6C",
  LightLavender: "#6B5780",
  DarkPurple: "#3B2E5C",
  Gold: "#7A5E22",
  SkyBlue: "#2F6F86",
  ForestGreen: "#3D5A42",
} as const;
export type SkillSwatchInk = (typeof SkillSwatchInk)[keyof typeof SkillSwatchInk];

export type SkillTone = {
  fill: SkillSwatch;
  background: SkillSwatchBg;
  color: SkillSwatchInk;
};

export const SKILL_TONE: Record<SkillSwatch, SkillTone> = {
  [SkillSwatch.DarkBlue]: {
    fill: SkillSwatch.DarkBlue,
    background: SkillSwatchBg.DarkBlue,
    color: SkillSwatchInk.DarkBlue,
  },
  [SkillSwatch.MediumPurple]: {
    fill: SkillSwatch.MediumPurple,
    background: SkillSwatchBg.MediumPurple,
    color: SkillSwatchInk.MediumPurple,
  },
  [SkillSwatch.LightLavender]: {
    fill: SkillSwatch.LightLavender,
    background: SkillSwatchBg.LightLavender,
    color: SkillSwatchInk.LightLavender,
  },
  [SkillSwatch.DarkPurple]: {
    fill: SkillSwatch.DarkPurple,
    background: SkillSwatchBg.DarkPurple,
    color: SkillSwatchInk.DarkPurple,
  },
  [SkillSwatch.Gold]: {
    fill: SkillSwatch.Gold,
    background: SkillSwatchBg.Gold,
    color: SkillSwatchInk.Gold,
  },
  [SkillSwatch.SkyBlue]: {
    fill: SkillSwatch.SkyBlue,
    background: SkillSwatchBg.SkyBlue,
    color: SkillSwatchInk.SkyBlue,
  },
  [SkillSwatch.ForestGreen]: {
    fill: SkillSwatch.ForestGreen,
    background: SkillSwatchBg.ForestGreen,
    color: SkillSwatchInk.ForestGreen,
  },
};

export const colorForSkillId = (skillId: number): string =>
  SKILL_COLOR[skillId as WefSkillId] ?? SkillSwatch.SkyBlue;

export const toneForSkillId = (skillId: number): SkillTone =>
  SKILL_TONE[colorForSkillId(skillId) as SkillSwatch] ?? SKILL_TONE[SkillSwatch.SkyBlue];

export const TaskBandId = {
  HumanLed: "human_led",
  AiAssisted: "ai_assisted",
  PartlyAutomated: "partly_automated",
  Reshaped: "reshaped",
} as const;
export type TaskBandId = (typeof TaskBandId)[keyof typeof TaskBandId];

export const TaskBandColor = {
  HumanLed: "#A2DCCF",
  AiAssisted: "#F0DE56",
  PartlyAutomated: "#F7C9D4",
  Reshaped: "#A8D4F5",
} as const;
export type TaskBandColor = (typeof TaskBandColor)[keyof typeof TaskBandColor];

export const TASK_BAND_COLOR: Record<TaskBandId, TaskBandColor> = {
  [TaskBandId.HumanLed]: TaskBandColor.HumanLed,
  [TaskBandId.AiAssisted]: TaskBandColor.AiAssisted,
  [TaskBandId.PartlyAutomated]: TaskBandColor.PartlyAutomated,
  [TaskBandId.Reshaped]: TaskBandColor.Reshaped,
};

export const TaskBandInk = {
  HumanLed: "#2F6F64",
  AiAssisted: "#7A6512",
  PartlyAutomated: "#9A4A5C",
  Reshaped: "#2F5F80",
} as const;
export type TaskBandInk = (typeof TaskBandInk)[keyof typeof TaskBandInk];

export const TASK_BAND_INK: Record<TaskBandId, TaskBandInk> = {
  [TaskBandId.HumanLed]: TaskBandInk.HumanLed,
  [TaskBandId.AiAssisted]: TaskBandInk.AiAssisted,
  [TaskBandId.PartlyAutomated]: TaskBandInk.PartlyAutomated,
  [TaskBandId.Reshaped]: TaskBandInk.Reshaped,
};

export type TaskBandTone = {
  fill: TaskBandColor;
  background: TaskBandColor;
  color: TaskBandInk;
};

export const TASK_BAND_TONE: Record<TaskBandId, TaskBandTone> = {
  [TaskBandId.HumanLed]: {
    fill: TaskBandColor.HumanLed,
    background: TaskBandColor.HumanLed,
    color: TaskBandInk.HumanLed,
  },
  [TaskBandId.AiAssisted]: {
    fill: TaskBandColor.AiAssisted,
    background: TaskBandColor.AiAssisted,
    color: TaskBandInk.AiAssisted,
  },
  [TaskBandId.PartlyAutomated]: {
    fill: TaskBandColor.PartlyAutomated,
    background: TaskBandColor.PartlyAutomated,
    color: TaskBandInk.PartlyAutomated,
  },
  [TaskBandId.Reshaped]: {
    fill: TaskBandColor.Reshaped,
    background: TaskBandColor.Reshaped,
    color: TaskBandInk.Reshaped,
  },
};

export const toneForTaskBand = (id: TaskBandId): TaskBandTone => TASK_BAND_TONE[id];

export const OccupationBandId = {
  NotExposed: "Not Exposed",
  MinimalExposure: "Minimal Exposure",
  Gradient1: "Exposed: Gradient 1",
  Gradient2: "Exposed: Gradient 2",
  Gradient3: "Exposed: Gradient 3",
  Gradient4: "Exposed: Gradient 4",
} as const;
export type OccupationBandId = (typeof OccupationBandId)[keyof typeof OccupationBandId];

export const OccupationBandColor = {
  NotExposed: "#7BB8A4",
  MinimalExposure: "#9EC9E4",
  Gradient1: "#F0C36A",
  Gradient2: "#E0A15A",
  Gradient3: "#D97A5A",
  Gradient4: "#C45C5C",
} as const;
export type OccupationBandColor = (typeof OccupationBandColor)[keyof typeof OccupationBandColor];

export const OccupationBandInk = {
  NotExposed: "#2F6F5C",
  MinimalExposure: "#2F5F80",
  Gradient1: "#7A6512",
  Gradient2: "#8F4F1F",
  Gradient3: "#9A3F32",
  Gradient4: "#8B2E2E",
} as const;
export type OccupationBandInk = (typeof OccupationBandInk)[keyof typeof OccupationBandInk];

export const OCCUPATION_BAND_COLOR: Record<OccupationBandId, OccupationBandColor> = {
  [OccupationBandId.NotExposed]: OccupationBandColor.NotExposed,
  [OccupationBandId.MinimalExposure]: OccupationBandColor.MinimalExposure,
  [OccupationBandId.Gradient1]: OccupationBandColor.Gradient1,
  [OccupationBandId.Gradient2]: OccupationBandColor.Gradient2,
  [OccupationBandId.Gradient3]: OccupationBandColor.Gradient3,
  [OccupationBandId.Gradient4]: OccupationBandColor.Gradient4,
};

export const OCCUPATION_BAND_INK: Record<OccupationBandId, OccupationBandInk> = {
  [OccupationBandId.NotExposed]: OccupationBandInk.NotExposed,
  [OccupationBandId.MinimalExposure]: OccupationBandInk.MinimalExposure,
  [OccupationBandId.Gradient1]: OccupationBandInk.Gradient1,
  [OccupationBandId.Gradient2]: OccupationBandInk.Gradient2,
  [OccupationBandId.Gradient3]: OccupationBandInk.Gradient3,
  [OccupationBandId.Gradient4]: OccupationBandInk.Gradient4,
};

export const UseTrendId = {
  Increasing: "increasing",
  Stable: "stable",
  Decreasing: "decreasing",
} as const;
export type UseTrendId = (typeof UseTrendId)[keyof typeof UseTrendId];

export const UseTrendColor = {
  Increasing: "#8EC8E6",
  Stable: "#6FBFB0",
  Decreasing: "#A88BB8",
} as const;
export type UseTrendColor = (typeof UseTrendColor)[keyof typeof UseTrendColor];

export const USE_TREND_COLOR: Record<UseTrendId, UseTrendColor> = {
  [UseTrendId.Increasing]: UseTrendColor.Increasing,
  [UseTrendId.Stable]: UseTrendColor.Stable,
  [UseTrendId.Decreasing]: UseTrendColor.Decreasing,
};

export const AiCapacityId = {
  VeryLow: "very_low",
  Low: "low",
  Moderate: "moderate",
  High: "high",
} as const;
export type AiCapacityId = (typeof AiCapacityId)[keyof typeof AiCapacityId];

export const AiCapacityColor = {
  VeryLow: "#3D8FD6",
  Low: "#8EC8E6",
  Moderate: "#C9B06A",
  High: "#8B6B2E",
} as const;
export type AiCapacityColor = (typeof AiCapacityColor)[keyof typeof AiCapacityColor];

export const AI_CAPACITY_COLOR: Record<AiCapacityId, AiCapacityColor> = {
  [AiCapacityId.VeryLow]: AiCapacityColor.VeryLow,
  [AiCapacityId.Low]: AiCapacityColor.Low,
  [AiCapacityId.Moderate]: AiCapacityColor.Moderate,
  [AiCapacityId.High]: AiCapacityColor.High,
};
