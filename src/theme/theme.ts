import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1E4DB7',
      dark: '#173B8C',
      light: '#EAF1FF',
    },
    background: {
      default: '#F7F9FC',
      paper: '#FFFFFF',
    },
    divider: '#E5EAF2',
    text: {
      primary: '#172033',
      secondary: '#5B6475',
    },
    success: { main: '#2E7D32' },
    warning: { main: '#ED6C02' },
    error: { main: '#D32F2F' },
    info: { main: '#0288D1' },
  },
  shape: { borderRadius: 10 },
  typography: {
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #E5EAF2',
          boxShadow: '0 2px 10px rgba(23,32,51,0.04)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
});

