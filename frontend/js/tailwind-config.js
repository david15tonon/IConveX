// Shared Tailwind theme for every page of the site.
// Loaded after the Tailwind CDN script and before anything renders, so both
// index.html and api.html get the same palette and type scale from one source.

  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          "surface-container-low": "#ecf4ff",
          "primary": "#004ac6",
          "surface-container-highest": "#dae3f0",
          "on-surface": "#131d25",
          "tertiary-container": "#007e37",
          "secondary-fixed-dim": "#bec6e0",
          "on-primary-fixed-variant": "#003ea8",
          "on-surface-variant": "#434655",
          "on-primary-fixed": "#00174b",
          "secondary": "#565e74",
          "inverse-primary": "#b4c5ff",
          "on-tertiary-container": "#c1ffc5",
          "on-error": "#ffffff",
          "on-secondary": "#ffffff",
          "on-secondary-container": "#5c647a",
          "surface-container-lowest": "#ffffff",
          "surface-container": "#e5effb",
          "on-secondary-fixed": "#131b2e",
          "on-secondary-fixed-variant": "#3f465c",
          "primary-fixed-dim": "#b4c5ff",
          "primary-fixed": "#dbe1ff",
          "on-error-container": "#93000a",
          "surface-bright": "#f7f9ff",
          "inverse-surface": "#28313b",
          "tertiary-fixed": "#6bff8f",
          "tertiary": "#006229",
          "outline-variant": "#c3c6d7",
          "on-background": "#131d25",
          "inverse-on-surface": "#e8f2fe",
          "tertiary-fixed-dim": "#4ae176",
          "primary-container": "#2563eb",
          "on-tertiary-fixed": "#002109",
          "background": "#f7f9ff",
          "on-primary": "#ffffff",
          "surface-container-high": "#dfe9f5",
          "surface-variant": "#dae3f0",
          "on-tertiary": "#ffffff",
          "on-tertiary-fixed-variant": "#005321",
          "secondary-container": "#dae2fd",
          "outline": "#737686",
          "surface": "#f7f9ff",
          "error": "#ba1a1a",
          "error-container": "#ffdad6",
          "secondary-fixed": "#dae2fd",
          "on-primary-container": "#eeefff",
          "surface-tint": "#0053db",
          "surface-dim": "#d1dbe7"
        },
        borderRadius: {
          "DEFAULT": "0.125rem",
          "lg": "0.25rem",
          "xl": "0.5rem",
          "full": "0.75rem"
        },
        spacing: {
          "margin": "32px",
          "unit": "4px",
          "gutter": "24px",
          "container-max": "1280px"
        },
        fontFamily: {
          "label-md": ["Geist", "sans-serif"],
          "headline-lg-mobile": ["Geist", "sans-serif"],
          "headline-md": ["Geist", "sans-serif"],
          "body-lg": ["Inter", "sans-serif"],
          "headline-lg": ["Geist", "sans-serif"],
          "body-md": ["Inter", "sans-serif"],
          "code-sm": ["Geist", "sans-serif"]
        },
        fontSize: {
          "label-md": ["12px", { lineHeight: "1", letterSpacing: "0.05em", fontWeight: "500" }],
          "headline-lg-mobile": ["24px", { lineHeight: "1.2", fontWeight: "600" }],
          "headline-md": ["20px", { lineHeight: "1.3", fontWeight: "600" }],
          "body-lg": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
          "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
          "body-md": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
          "code-sm": ["13px", { lineHeight: "1.4", fontWeight: "400" }]
        }
      }
    }
  };
