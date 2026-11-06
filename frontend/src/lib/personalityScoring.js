// The user-provided 60 items are arranged in five 12-item blocks by trait.
// Reverse-keyed items are recoded as 6 - response before averaging.
export const PERSONALITY_TRAITS = [
  {
    key: "sensitivity",
    label: "Sensitivity",
    color: "#e95d7b",
    items: [
      [0, true], [5, true], [10, false], [15, false], [20, true], [25, true],
      [30, false], [35, false], [40, true], [45, true], [50, false], [55, false],
    ],
    higher: "You report noticing stress and emotional shifts more strongly.",
    lower: "You report feeling relatively steady when stress or strong emotions arise.",
    middle: "Your responses show a mix of steadiness and emotional sensitivity across situations.",
  },
  {
    key: "extraversion",
    label: "Extraversion",
    color: "#e8a018",
    items: [
      [1, false], [6, false], [11, true], [16, true], [21, false], [26, true],
      [31, true], [36, true], [41, false], [46, false], [51, true], [56, false],
    ],
    higher: "You report bringing more outward energy, talk, and initiative to social settings.",
    lower: "You report preferring quieter settings and time to think before speaking.",
    middle: "Your responses suggest your social energy may depend on the setting and people around you.",
  },
  {
    key: "openness",
    label: "Openness",
    color: "#8c65e8",
    items: [
      [2, false], [7, true], [12, false], [17, true], [22, false], [27, true],
      [32, true], [37, false], [42, false], [47, false], [52, true], [57, true],
    ],
    higher: "You report being drawn to ideas, imagination, creativity, or aesthetic experiences.",
    lower: "You report leaning more toward familiar, practical, and concrete approaches.",
    middle: "Your responses suggest you balance curiosity about new ideas with practical preferences.",
  },
  {
    key: "agreeableness",
    label: "Agreeableness",
    color: "#24a982",
    items: [
      [3, true], [8, false], [13, false], [18, false], [23, true], [28, true],
      [33, true], [38, false], [43, true], [48, false], [53, true], [58, false],
    ],
    higher: "You report leaning toward compassion, respect, and cooperation with others.",
    lower: "You report leaning toward directness and independent judgment in disagreements.",
    middle: "Your responses suggest you balance consideration for others with speaking your mind.",
  },
  {
    key: "conscientiousness",
    label: "Conscientiousness",
    color: "#4b8be8",
    items: [
      [4, false], [9, true], [14, true], [19, true], [24, true], [29, false],
      [34, false], [39, false], [44, false], [49, true], [54, false], [59, true],
    ],
    higher: "You report preferring plans, organization, and following tasks through.",
    lower: "You report preferring flexibility and leaving more room to adapt as you go.",
    middle: "Your responses suggest you use structure when it helps and flexibility when it fits.",
  },
];

export function calculatePersonalityScores(answers = {}) {
  return PERSONALITY_TRAITS.reduce((scores, trait) => {
    const values = trait.items
      .map(([index, reverse]) => {
        const response = Number(answers[index]);
        if (!Number.isInteger(response) || response < 1 || response > 5) return null;
        return reverse ? 6 - response : response;
      })
      .filter((value) => value !== null);

    if (values.length !== trait.items.length) return scores;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    scores[trait.key] = Math.round(((average - 1) / 4) * 100);
    return scores;
  }, {});
}

export function describePersonalityScore(score, trait) {
  if (score >= 61) return trait.higher;
  if (score <= 39) return trait.lower;
  return trait.middle;
}

export function getStrongestPersonalityTrait(scores = {}) {
  const ranked = [...PERSONALITY_TRAITS]
    .filter((trait) => Number.isFinite(Number(scores[trait.key])))
    .sort((left, right) => Number(scores[right.key]) - Number(scores[left.key]));
  if (!ranked.length) return null;
  if (ranked.length > 1 && Number(scores[ranked[0].key]) === Number(scores[ranked[1].key])) return null;
  return ranked[0];
}
