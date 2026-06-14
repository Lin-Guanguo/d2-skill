export type RenderPresetName = 'share-tall';

export interface RenderPreset {
  name: RenderPresetName;
  width: number;
  height: number;
}

export interface RenderMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface RenderTableColumn {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface RenderTableSection {
  kind: 'table';
  title: string;
  columns: RenderTableColumn[];
  rows: Array<Record<string, string>>;
}

export interface RenderListItem {
  title: string;
  value?: string;
  detail?: string;
}

export interface RenderListSection {
  kind: 'list';
  title: string;
  items: RenderListItem[];
}

export interface RenderCardItem {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  metrics: RenderMetric[];
  badge?: string;
}

export interface RenderCardGridSection {
  kind: 'card-grid';
  title: string;
  cards: RenderCardItem[];
  columns?: 2 | 3;
  cardWidth?: number;
  cardHeight?: number;
}

export interface RenderStatGridSection {
  kind: 'stat-grid';
  title: string;
  metrics: RenderMetric[];
}

export type RenderSection =
  | RenderTableSection
  | RenderListSection
  | RenderStatGridSection
  | RenderCardGridSection;

export interface RenderDocument {
  preset: RenderPreset;
  title: string;
  subtitle?: string;
  kicker?: string;
  backgroundImageUrl?: string | null;
  metrics: RenderMetric[];
  sections: RenderSection[];
  footer?: string;
}

export interface RenderArtifact {
  type: 'image/png';
  path: string;
  preset: RenderPresetName;
  width: number;
  height: number;
}

const RENDER_PRESETS: Record<RenderPresetName, RenderPreset> = {
  'share-tall': {
    name: 'share-tall',
    width: 1080,
    height: 1920,
  },
};

export function defaultRenderPreset(): RenderPreset {
  return RENDER_PRESETS['share-tall'];
}
