import { Font } from "@react-pdf/renderer";

/**
 * Register Roboto font family for Romanian diacritics support (ș, ț, ă, î, â).
 * Must be imported before any PDF template is rendered.
 */
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9.ttf",
      fontWeight: "bold",
    },
  ],
});

// Disable word hyphenation for Romanian text
Font.registerHyphenationCallback((word) => [word]);
