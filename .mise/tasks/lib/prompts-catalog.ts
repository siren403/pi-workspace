export interface PromptSource {
  slug: string;
  name: string;
  repo: string;
  contentPath: string;
  stripFrontmatter: boolean;
  description: string;
  tags: string[];
}

export const CATALOG: PromptSource[] = [
  {
    slug: "karpathy",
    name: "Karpathy Guidelines",
    repo: "forrestchang/andrej-karpathy-skills",
    contentPath: "CLAUDE.md",
    stripFrontmatter: false,
    description: "LLM 코딩 실수를 줄이는 행동 지침 (Andrej Karpathy 관찰 기반)",
    tags: ["coding", "behavior", "quality"],
  },
];

export function findBySlug(slug: string): PromptSource | undefined {
  return CATALOG.find((s) => s.slug === slug);
}

/** owner/repo 형식이면 true */
export function isRepoRef(s: string): boolean {
  return /^[^/]+\/[^/]+$/.test(s);
}

/** repo 레퍼런스에서 slug 추출 (마지막 세그먼트) */
export function slugFromRepo(repo: string): string {
  return repo.split("/").pop()!.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}
