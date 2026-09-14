/**
 * KubHai design tokens sampled from the official logo asset
 * public/brand/kubhai-logo.jpg (1024×1024, approved baseline).
 *
 * Navy cluster: #00163E … #003B7D
 * Accent (Hai / pin / smile): #EF8D12 … #FCAD12 … #FFE607
 * Wordmark white: #FAFAFB / #FFFFFF
 *
 * Do not scatter hex colors through UI code. Import from here
 * or use the matching CSS variables in globals.css.
 */

export const kubhaiBrand = {
  name: "KubHai",
  nameTh: "ขับให้",
  logoSrc: "/brand/kubhai-logo.jpg",
  colors: {
    navy950: "#00163E",
    navy900: "#001840",
    navy800: "#01244F",
    navy700: "#002A5D",
    navy600: "#00326C",
    navy500: "#003B7D",
    navy400: "#004888",
    accent: "#FCAD12",
    accentDeep: "#EF8D12",
    accentBright: "#FFE607",
    white: "#FFFFFF",
    paper: "#FAFAFB",
    ink: "#0F1724",
    muted: "#5B6573",
    line: "#E6E8EC",
    danger: "#C23B2E",
    success: "#1F7A4D",
  },
} as const;

/** Default store palette when a business has no configured colors. Not official POND when used for other stores. */
export const storePlaceholderBrand = {
  primary: "#1A3C34",
  primarySoft: "#E7EFEA",
  accent: "#C4A35A",
  paper: "#F7F3EA",
} as const;
