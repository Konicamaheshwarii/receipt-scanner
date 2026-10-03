import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'Receipto: receipt scanner and spending dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
  { path: 'scan', title: 'Scan a receipt · Receipto', loadComponent: () => import('./features/scan/scan.page').then((m) => m.ScanPage) },
  { path: 'review', title: 'Review · Receipto', loadComponent: () => import('./features/review/review.page').then((m) => m.ReviewPage) },
  { path: 'edit/:id', title: 'Edit expense · Receipto', loadComponent: () => import('./features/review/review.page').then((m) => m.ReviewPage) },
  { path: 'expenses', title: 'Expenses · Receipto', loadComponent: () => import('./features/expenses/expenses.page').then((m) => m.ExpensesPage) },
  { path: 'settings', title: 'Settings · Receipto', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
  { path: '**', redirectTo: '' },
];
