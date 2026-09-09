import { test, expect } from '@playwright/test';
import { fitsViewport, login, bookingOptions } from './helpers';

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1366, height: 768 }, { width: 844, height: 390 }]) {
  test(`calendário principal e horários sem rolagem em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await fitsViewport(page);
    await login(page);
    const calendar = page.getByRole('region', { name: 'Calendário de disponibilidade' });
    await expect(calendar).toBeVisible();
    await expect(page.getByLabel('Cliente', { exact: true })).toHaveCount(0);
    await bookingOptions(page);
    await calendar.getByRole('button', { name: 'Próximo mês' }).click();
    const available = calendar.getByRole('button', { name: /: Disponível$/ }).first();
    const unavailable = calendar.getByRole('button', { name: /: Sem horários disponíveis$/ }).first();
    await expect(available).toHaveAttribute('data-availability', 'available');
    await expect(unavailable).toHaveAttribute('data-availability', 'unavailable');
    await expect(unavailable).toHaveCSS('background-color', 'rgb(255, 223, 181)');
    await expect(available).toHaveCSS('background-color', 'rgb(240, 234, 250)');
    await fitsViewport(page);
    await available.focus();
    await page.keyboard.press('Enter');
    await expect(calendar).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Horários disponíveis' })).toBeVisible();
    await fitsViewport(page);
    await expect.poll(() => page.locator('.slot-picker').evaluate(el => {
      const grid = el.querySelector('.slot-grid')!.getBoundingClientRect();
      return grid.height / el.getBoundingClientRect().height;
    })).toBeGreaterThan(0.5);
    const next = page.getByRole('button', { name: 'Próximos', exact: true });
    if (await next.count()) { await next.click(); await fitsViewport(page); }
    await page.getByRole('button', { name: 'Voltar ao calendário', exact: true }).click();
    await unavailable.click();
    await expect(page.getByText('Sem horários disponíveis', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
    await fitsViewport(page);
    await page.getByRole('button', { name: 'Voltar ao calendário', exact: true }).click();
    await calendar.getByRole('button', { name: 'Mês anterior' }).click();
    await calendar.getByRole('button', { name: 'Mês anterior' }).click();
    await calendar.getByRole('button', { name: /: Data passada$/ }).first().click();
    await fitsViewport(page);
    await page.getByRole('tab', { name: 'Agendamentos', exact: true }).click();
    await fitsViewport(page);
    await expect(page.getByLabel('Filtrar por data', { exact: true })).toBeVisible();
  });
}
