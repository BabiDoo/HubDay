import { ptBR } from "@mui/material/locale";
import { createTheme } from "@mui/material/styles";

// Official tokens from Branding Kit Standalone.html (renderVals defaults).
export const brand = {
  primary: "#6b21e8", primaryDark: "#68378d", surface: "#f0eafa",
  ink: "#231c2b", subtle: "#948b9e", background: "#f7f5fb",
  border: "#e7e1ed", muted: "#655970",
};

export const theme = createTheme({
  palette: {
    primary: { main: brand.primary, dark: brand.primaryDark, light: brand.surface, contrastText: "#fff" },
    secondary: { main: brand.primaryDark },
    background: { default: brand.background, paper: "#ffffff" },
    text: { primary: brand.ink, secondary: brand.muted },
    divider: brand.border,
    success: { main: brand.primaryDark, light: brand.surface, dark: brand.primaryDark },
    error: { main: "#c0392b", light: "#fdecec" },
    action: { hover: brand.surface, selected: brand.surface },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 14,
    h1: { fontSize: 36, fontWeight: 700 }, h2: { fontSize: 24, fontWeight: 700 },
    body1: { fontSize: 14 }, body2: { fontSize: 14 },
    button: { textTransform: "none", fontSize: 14, fontWeight: 700 },
    caption: { fontSize: 12 },
  },
  components: {
    MuiButton: {
      defaultProps: { variant: "outlined", disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 40 },
        outlined: { "&.MuiButton-colorPrimary": { color: brand.ink, borderColor: brand.border, backgroundColor: "#fff", "&:hover": { borderColor: brand.primaryDark, backgroundColor: brand.surface } } },
        text: { "&.MuiButton-colorPrimary": { color: brand.primaryDark } },
        contained: { "&.MuiButton-colorPrimary": { backgroundColor: brand.primary, color: "#fff", "&:hover": { backgroundColor: brand.primaryDark } } },
      },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10, backgroundColor: "#fff" }, notchedOutline: { borderColor: brand.border } } },
    MuiFormLabel: { styleOverrides: { root: { color: brand.muted, fontSize: 14, fontWeight: 600 } } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { outlined: { borderColor: brand.border, boxShadow: "0 6px 18px rgba(0,0,0,0.04)" } } },
    MuiTab: { styleOverrides: { root: { minWidth: 0, textTransform: "none", fontWeight: 600, borderRadius: 10, "&.Mui-selected": { color: brand.primaryDark, backgroundColor: brand.surface } } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: brand.primaryDark } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 20, fontWeight: 700 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
  },
}, ptBR);
