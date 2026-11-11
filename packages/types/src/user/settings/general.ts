import type { HighlighterProps, MermaidProps, NeutralColors, PrimaryColors } from '@lobehub/ui';

import type { ResponseAnimationStyle } from '../../aiProvider';

export type AnimationMode = 'disabled' | 'agile' | 'elegant';

export type ContextMenuMode = 'disabled' | 'default';

export type BackgroundDevice = 'desktop' | 'mobile';

export interface BackgroundImage {
  /** A stable application file route, never an expiring signed storage URL. */
  id: string;
  name: string;
  url: string;
}

export interface BackgroundConfig {
  activeImageId?: string;
  blur: number;
  enabled: boolean;
  images: BackgroundImage[];
  intervalSeconds: number;
  opacity: number;
  overlayColor: 'auto' | 'black' | 'white';
  overlayOpacity: number;
  slideshow: boolean;
}

export type GlobalBackgroundConfig = Partial<Record<BackgroundDevice, BackgroundConfig>>;

export interface UserGeneralConfig {
  animationMode?: AnimationMode;
  /** Account-synced, independently configured desktop and mobile wallpapers. */
  background?: GlobalBackgroundConfig;
  contextMenuMode?: ContextMenuMode;
  costEstimateWarningThreshold?: number;
  /**
   * Whether to auto-scroll during AI streaming output
   * @default true
   */
  enableAutoScrollOnStreaming?: boolean;
  /**
   * Whether to show the website/favicon icon before links in chat messages.
   * Turning it off renders plain links, which copy cleanly into email and other apps.
   * @default true
   */
  enableMessageLinkIcon?: boolean;
  /** Allow the model to inspect a directory of recently updated topics. */
  enableProactiveTopicReading?: boolean;
  /** Allow the model to read a user-provided topic/conversation ID. */
  enableTopicReference?: boolean;
  fontSize: number;
  highlighterTheme?: HighlighterProps['theme'];
  /** Attach a fresh minute-resolution timestamp to every model request. Default: false. */
  injectCurrentTime?: boolean;
  isDevMode: boolean;
  isLiteMode: boolean;
  mermaidTheme?: MermaidProps['theme'];
  neutralColor?: NeutralColors;
  primaryColor?: PrimaryColors;
  /** Number of recent topics to expose, or `auto` to expose the latest 25. */
  proactiveTopicReadingCount?: number | 'auto';
  responseLanguage?: string;
  telemetry: boolean;
  timezone?: string;
  transitionMode?: ResponseAnimationStyle;
}
