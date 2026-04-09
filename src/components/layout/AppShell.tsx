'use client';

import * as React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  AppBar,
  Avatar,
  Box,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import {
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Settings,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';

import { useRoleStore } from '@/stores/useRoleStore';
import { APP_ROLES, type AppRole } from '@/types/role';

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { key: 'menu', label: 'Menu & Consumption', href: '/menu-consumption', icon: <Utensils size={18} /> },
  { key: 'waste', label: 'Waste & Utilities', href: '/waste-utilities', icon: <Trash2 size={18} /> },
  { key: 'stock', label: 'Stock & Inventory', href: '/stock', icon: <Package size={18} /> },
  { key: 'requests', label: 'Requests & Issues', href: '/requests', icon: <ClipboardList size={18} /> },
  { key: 'feedback', label: 'Feedback', href: '/feedback', icon: <MessageSquareText size={18} /> },
  { key: 'recs', label: 'Recommendations', href: '/recommendations', icon: <Sparkles size={18} /> },
  { key: 'reports', label: 'Reports', href: '/reports', icon: <FileText size={18} /> },
  { key: 'notifications', label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
  { key: 'settings', label: 'Demo Settings', href: '/settings-demo', icon: <Settings size={18} /> },
];

const DRAWER_WIDTH = 280;

function getNavOrderForRole(role: AppRole): string[] {
  switch (role) {
    case 'Chef':
      return ['dashboard', 'menu', 'waste', 'requests', 'recs', 'feedback', 'reports', 'notifications', 'stock', 'settings'];
    case 'Store Manager':
      return ['stock', 'requests', 'notifications', 'reports', 'dashboard', 'recs', 'waste', 'menu', 'feedback', 'settings'];
    case 'Canteen Manager':
      return ['dashboard', 'waste', 'feedback', 'reports', 'recs', 'notifications', 'menu', 'requests', 'stock', 'settings'];
    case 'Management':
      return ['dashboard', 'reports', 'recs', 'notifications', 'feedback', 'menu', 'waste', 'stock', 'requests', 'settings'];
    case 'Admin':
    default:
      return NAV_ITEMS.map((i) => i.key);
  }
}

function getNavItemsByRole(role: AppRole): NavItem[] {
  const order = getNavOrderForRole(role);
  const rank = new Map(order.map((key, idx) => [key, idx]));
  return [...NAV_ITEMS].sort((a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, setRole } = useRoleStore();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navItems = React.useMemo(() => getNavItemsByRole(role), [role]);

  const toggleMobileDrawer = () => setMobileOpen((open) => !open);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
          Smart Canteen
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Madura Coats (Demo)
        </Typography>
      </Box>

      <Divider />

      <Box sx={{ p: 1 }}>
        <List dense disablePadding>
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            return (
              <ListItemButton
                key={item.key}
                component={Link}
                href={item.href}
                selected={active}
                onClick={() => setMobileOpen(false)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.light,
                  },
                  '&.Mui-selected:hover': {
                    backgroundColor: theme.palette.primary.light,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.main' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 700 : 600 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Box sx={{ mt: 'auto', p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Role-aware demo • Frontend only
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', backgroundColor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        color="inherit"
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {!isMdUp ? (
            <IconButton edge="start" onClick={toggleMobileDrawer} aria-label="Open navigation">
              <LayoutDashboard size={18} />
            </IconButton>
          ) : null}

          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Smart Canteen
            </Typography>
            <Divider flexItem orientation="vertical" />
            <Typography variant="body2" color="text.secondary" noWrap>
              {format(new Date(), 'EEE, dd MMM yyyy')}
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Select<AppRole>
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              size="small"
              sx={{ minWidth: 170 }}
              aria-label="Role"
            >
              {APP_ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </Select>

            <Tooltip title="Notifications">
              <IconButton component={Link} href="/notifications" aria-label="Open notifications">
                <Bell size={18} />
              </IconButton>
            </Tooltip>

            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12 }}>MC</Avatar>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: DRAWER_WIDTH },
          flexShrink: { md: 0 },
        }}
        aria-label="Navigation"
      >
        <Drawer
          variant={isMdUp ? 'permanent' : 'temporary'}
          open={isMdUp ? true : mobileOpen}
          onClose={toggleMobileDrawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRightColor: 'divider',
              top: 0,
            },
          }}
        >
          <Toolbar />
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar />
        <Container maxWidth="xl" sx={{ py: 3 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
