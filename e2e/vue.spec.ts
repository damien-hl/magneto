import { test, expect } from '@playwright/test'

const content =
  'INFO démarrage\nERROR Payment timeout\nWARN payment lent\nDEBUG diagnostic\nmessage inconnu\n'

async function openLogs(page: import('@playwright/test').Page, text = content) {
  await page.getByLabel('Choisir un fichier de logs').setInputFiles({
    name: 'application.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(text),
  })

  await expect(page.getByText('Prêt à explorer', { exact: true })).toBeVisible()
}

test('indexe, filtre, ouvre et ferme le contexte, puis remplace le fichier', async ({ page }) => {
  await page.goto('/')
  await openLogs(page)

  await expect(page.locator('.log-row')).toHaveCount(5)

  await page.getByRole('checkbox', { name: 'ERROR', exact: true }).check()
  await page.getByRole('searchbox').fill('PAYMENT timeout')
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click()

  await expect(page.locator('.log-row')).toHaveCount(1)
  await expect(page.locator('.log-row')).toContainText('ERROR Payment timeout')
  await expect(page.locator('.level--error')).toHaveCSS('color', 'rgb(189, 75, 65)')

  await page.locator('.log-row').focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('region', { name: 'Contexte de la ligne' })).toBeVisible()
  await expect(page.locator('.context-row')).toHaveCount(5)
  await expect(page.locator('.context-row--selected')).toContainText('ERROR Payment timeout')
  await expect(page.locator('.context-row--selected')).toBeInViewport()

  await page.getByRole('button', { name: 'Fermer' }).click()

  await expect(page.locator('.context')).toHaveCount(0)

  await page.getByRole('searchbox').fill('introuvable')
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click()

  await expect(page.getByText('Aucune ligne à afficher.')).toBeVisible()

  await openLogs(page, 'INFO remplacement')

  await expect(page.getByRole('checkbox', { name: 'ERROR', exact: true })).not.toBeChecked()
  await expect(page.getByRole('searchbox')).toHaveValue('')
  await expect(page.locator('.log-row')).toContainText('INFO remplacement')
})

test('gère les fichiers vides et les erreurs de format', async ({ page }) => {
  await page.goto('/')
  await openLogs(page, '')

  await expect(page.getByText('Aucune ligne à afficher.')).toBeVisible()

  await page.getByLabel('Choisir un fichier de logs').setInputFiles({
    name: 'utf16.log',
    mimeType: 'text/plain',
    buffer: Buffer.from([255, 254, 65, 0]),
  })

  await expect(page.getByRole('alert')).toContainText('UTF-16')
  await expect(page.getByRole('button', { name: 'Réindexer le fichier' })).toBeEnabled()

  await openLogs(page)

  await expect(page.locator('.log-row')).toHaveCount(5)
})

test('reste utilisable sur mobile et avec une grande taille de texte', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.addStyleTag({ content: 'html { font-size: 20px; }' })
  await openLogs(page)

  await expect(page.locator('.log-row')).toHaveCount(5)

  const rows = await page.locator('.log-row').evaluateAll((elements) =>
    elements.map((el) => {
      const { top, height } = el.getBoundingClientRect()
      return { top, height }
    }),
  )

  expect(rows[1]!.top - rows[0]!.top).toBe(rows[0]!.height)
  const { scrollWidth, clientWidth } = await page.locator('html').evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }))

  // Une barre de défilement verticale peut réduire la largeur disponible.
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
})

test('navigue entre les pages et revient au début après une recherche', async ({ page }) => {
  await page.goto('/')
  await openLogs(page, Array.from({ length: 20_010 }, (_, i) => `INFO message ${i + 1}`).join('\n'))
  await page.getByRole('button', { name: 'Page suivante' }).click()

  await expect(page.locator('.log-row').first()).toContainText('INFO message 20001')

  await page.getByRole('spinbutton', { name: 'Résultat' }).fill('20010')
  await page.getByRole('button', { name: 'Aller', exact: true }).click()

  await expect(page.locator('.log-row').last()).toContainText('INFO message 20010')

  await page.getByRole('searchbox').fill('message 1')
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click()

  await expect(page.locator('.log-row').first()).toContainText('INFO message 1')
  await expect(page.getByRole('button', { name: 'Page précédente' })).toBeDisabled()
})

test('centre la ligne sélectionnée après le chargement du contexte', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('/')
  await openLogs(
    page,
    Array.from({ length: 11 }, (_, i) => `INFO ligne ${i + 1} ${'détail '.repeat(80)}`).join('\n'),
  )

  await page.locator('.log-row').nth(5).click()
  await expect(page.locator('.context-row')).toHaveCount(11)

  const selected = page.locator('.context-row--selected')
  await expect(selected).toContainText('INFO ligne 6')
  await expect
    .poll(() =>
      selected.evaluate((el) => {
        const { top, height } = el.getBoundingClientRect()
        return Math.abs(top + height / 2 - el.ownerDocument.defaultView!.innerHeight / 2)
      }),
    )
    .toBeLessThanOrEqual(1)
})

test('annule une indexation en cours puis ouvre un autre fichier', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choisir un fichier de logs').setInputFiles({
    name: 'large.log',
    mimeType: 'text/plain',
    buffer: Buffer.from('INFO message suffisamment long pour plusieurs blocs\n'.repeat(300_000)),
  })
  await page.getByRole('button', { name: 'Annuler', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Réindexer le fichier' })).toBeEnabled()

  await openLogs(page, 'INFO nouveau fichier')

  await expect(page.locator('.log-row')).toHaveCount(1)
  await expect(page.locator('.log-row')).toContainText('INFO nouveau fichier')
})

test('remplace le fichier pendant son indexation', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choisir un fichier de logs').setInputFiles({
    name: 'large.log',
    mimeType: 'text/plain',
    buffer: Buffer.from('INFO première indexation\n'.repeat(500_000)),
  })
  await openLogs(page, 'ERROR remplacement immédiat')

  await expect(page.locator('.log-row')).toHaveCount(1)
  await expect(page.locator('.log-row')).toContainText('ERROR remplacement immédiat')
})
