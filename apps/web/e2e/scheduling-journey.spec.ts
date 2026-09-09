import { test, expect } from '@playwright/test';
import { fitsViewport, login, bookingOptions } from './helpers';

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
test(`agendar, reagendar e cancelar em ${viewport.width}x${viewport.height}`, async ({ page, request }) => {
  await page.setViewportSize(viewport);
  await login(page);
  await bookingOptions(page);
  const calendar = page.getByRole('region', { name: 'Calendário de disponibilidade' });
  await calendar.getByRole('button', { name: 'Próximo mês' }).click();
  const day = calendar.getByRole('button', { name: /: Disponível$/ }).first();
  const date = (await day.getAttribute('aria-label'))!.slice(0, 10);
  await day.click();
  await page.getByLabel('Cliente', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('radio').first().click();
  const createdResponse = page.waitForResponse(res => res.url().endsWith('/appointments') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar agendamento', exact: true }).click();
  const response = await createdResponse;
  expect(response.status()).toBe(201);
  const created = await response.json();
  try {
    await expect(page.getByText('Agendamento confirmado', { exact: true })).toBeVisible();
    await fitsViewport(page);
    await page.getByRole('tab', { name: 'Agendamentos', exact: true }).click();
    const card = page.getByRole('article', { name: 'Detalhes do agendamento' });
    // Locate only the appointment created by this test, without resetting user data.
    const dateText = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(created.startsAt));
    for (let i = 0; i < 200 && !(await card.textContent())?.includes(dateText); i++) {
      await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    }
    await expect(card).toContainText(dateText);
    await page.getByRole('button', { name: 'Reagendar', exact: true }).click();
    await fitsViewport(page);
    await calendar.getByRole('button', { name: 'Próximo mês' }).click();
    await calendar.getByRole('button', { name: new RegExp(`^${date}:`) }).click();
    await page.getByRole('radio').first().click();
    await fitsViewport(page);
    await page.getByRole('button', { name: 'Confirmar novo horário', exact: true }).click();
    await expect(page.getByText(/^Reagendado para /)).toBeVisible();
    await fitsViewport(page);
    await page.getByRole('button', { name: 'Voltar aos agendamentos', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByText('Agendamento cancelado. O horário está disponível novamente.')).toBeVisible();
    await fitsViewport(page);
  } finally {
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem('hubday.session')!).token);
    const result = await request.get('http://localhost:3000/appointments?status=scheduled', { headers: { Authorization: `Bearer ${token}` } });
    if ((await result.json()).appointments.some((item: { id: string }) => item.id === created.id)) {
      await request.post(`http://localhost:3000/appointments/${created.id}/cancel`, { headers: { Authorization: `Bearer ${token}` } });
    }
  }
});

}
