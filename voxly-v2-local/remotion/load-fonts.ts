import { loadFont } from "@remotion/google-fonts/Montserrat";

// Loading the font registers an @font-face and holds the render until the font
// is ready (handled internally by @remotion/google-fonts). Only the weights we
// actually use, to keep the load light.
const { fontFamily } = loadFont("normal", {
  weights: ["600", "700", "800", "900"],
  subsets: ["latin"],
});

export const montserrat = fontFamily;
