import { expect, type Page } from "@playwright/test";

export async function fitsViewport(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const root = document.documentElement;
    const outside = [...document.querySelectorAll('button, input, select, [role="tab"]')].filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.top < -1 || rect.left < -1 || rect.bottom > innerHeight + 1 || rect.right > innerWidth + 1);
    }).map(el => el.getAttribute('aria-label') || el.textContent);
    return { width: root.scrollWidth <= innerWidth, height: root.scrollHeight <= innerHeight, outside };
  })).toEqual({ width: true, height: true, outside: [] });
}
export async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill('owner@aurora.test');
  await page.getByLabel('Senha', { exact: true }).fill('hubday-dev');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Agendar', exact: true })).toBeVisible();
}
export async function bookingOptions(page: Page) {
  await page.getByLabel('Profissional', { exact: true }).selectOption({ label: 'Alice Moreira' });
  await page.getByLabel('Serviço', { exact: true }).selectOption({ label: 'Consulta rapida (30 min)' });
}
