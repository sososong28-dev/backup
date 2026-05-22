export const BOT_PROFILES = Object.freeze({
  tag: {
    id: "tag",
    label: "紧凶",
    callThreshold: 0.48,
    pressurePenalty: 0.28,
    baseCall: 0.24,
    raiseStrong: 0.78,
    raiseMedium: 0.66,
    raiseStrongChance: 0.11,
    raiseMediumChance: 0.045,
    postflopTendency: 0.08,
  },
  loose: {
    id: "loose",
    label: "松凶",
    callThreshold: 0.39,
    pressurePenalty: 0.22,
    baseCall: 0.29,
    raiseStrong: 0.74,
    raiseMedium: 0.62,
    raiseStrongChance: 0.16,
    raiseMediumChance: 0.07,
    postflopTendency: 0.13,
  },
  nit: {
    id: "nit",
    label: "紧弱",
    callThreshold: 0.57,
    pressurePenalty: 0.32,
    baseCall: 0.18,
    raiseStrong: 0.83,
    raiseMedium: 0.73,
    raiseStrongChance: 0.07,
    raiseMediumChance: 0.02,
    postflopTendency: 0.03,
  },
  short: {
    id: "short",
    label: "短码",
    callThreshold: 0.43,
    pressurePenalty: 0.18,
    baseCall: 0.27,
    raiseStrong: 0.68,
    raiseMedium: 0.58,
    raiseStrongChance: 0.18,
    raiseMediumChance: 0.09,
    postflopTendency: 0.16,
  },
  hero: {
    id: "hero",
    label: "训练位",
    callThreshold: 0.5,
    pressurePenalty: 0.25,
    baseCall: 0.22,
    raiseStrong: 0.78,
    raiseMedium: 0.66,
    raiseStrongChance: 0.1,
    raiseMediumChance: 0.04,
    postflopTendency: 0.08,
  },
});

export function resolveBotProfile(player, tableConfig) {
  const stackBb = tableConfig.bigBlind > 0 ? player.stack / tableConfig.bigBlind : player.stack;

  if (player.style === "短码" || stackBb <= 18) {
    return BOT_PROFILES.short;
  }
  if (player.type === "loose") {
    return BOT_PROFILES.loose;
  }
  if (player.type === "nit") {
    return BOT_PROFILES.nit;
  }
  if (player.type === "hero") {
    return BOT_PROFILES.hero;
  }
  return BOT_PROFILES.tag;
}
