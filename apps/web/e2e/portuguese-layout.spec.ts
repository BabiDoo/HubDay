import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { fitsViewport, login, bookingOptions } from './helpers';

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`lista extensa com paginação em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const now = new Date().toISOString();
    const appointments = Array.from({ length: 25 }, (_, index) => ({
      id: randomUUID(), professionalId: randomUUID(), serviceId: randomUUID(), customerId: randomUUID(),
      professionalName: 'Profissional de demonstração', serviceName: `Atendimento ${index + 1}`,
      serviceDurationMinutes: 30, customerName: 'Cliente de demonstração',
      startsAt: now, endsAt: now, status: 'scheduled', createdAt: now, updatedAt: now,
    }));
    appointments[0]!.startsAt = '2030-01-02T01:00:00.000Z';
    await page.route('**/appointments?*', route => route.fulfill({ json: { appointments } }));
    await login(page);
    await page.getByRole('tab', { name: 'Agendamentos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Atendimento 1', exact: true })).toBeVisible();
    await fitsViewport(page);
    await page.getByLabel('Filtrar por data', { exact: true }).fill('2030-01-01');
    await expect(page.getByRole('heading', { name: 'Atendimento 1', exact: true })).toBeVisible();
    await expect(page.getByText('1 de 1', { exact: true })).toBeVisible();
    await page.getByLabel('Filtrar por data', { exact: true }).fill('2000-01-01');
    await expect(page.getByText('Nenhum agendamento', { exact: true })).toBeVisible();
    await fitsViewport(page);
    await page.getByRole('button', { name: 'Limpar filtro de data' }).click();
    for (let index = 1; index < 25; index++) await page.getByRole('button', { name: 'Próximo', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Atendimento 25', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Próximo', exact: true })).toBeDisabled();
    await fitsViewport(page);
    await page.getByRole('button', { name: 'Anterior', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Atendimento 24', exact: true })).toBeVisible();
    await fitsViewport(page);
  });
}

test('erros da API em inglês são apresentados em português', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/availability?*', route => route.fulfill({ status: 403, json: {
    code: 'FORBIDDEN', message: 'Access denied', statusCode: 403, requestId: 'test',
  } }));
  await login(page);
  await bookingOptions(page);
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  await fitsViewport(page);
  await page.getByRole('button', { name: /: Falha na consulta$/ }).first().click();
  await expect(page.getByText('Você não tem permissão para realizar esta ação.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Access denied');
  await fitsViewport(page);
});
