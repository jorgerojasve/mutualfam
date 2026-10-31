#!/usr/bin/env node
/**
 * ==============================================================================
 * Suite de Automatización de Pruebas QA - MutualFam (Previa a Producción)
 * ==============================================================================
 * Valida de forma exhaustiva y end-to-end todas las funcionalidades de la
 * plataforma en el entorno QA antes de autorizar el pase a Producción:
 *
 *  1. Configuración Global, Límites y Detección de Entorno
 *  2. Autenticación, JWT, Renovación (Refresh) y Perfiles de Usuario
 *  3. Creación de Mutuales y Reglas de Límites (Bootstrap y Extra Mutuals)
 *  4. Invitaciones de Un Solo Uso y Blindaje contra Duplicados (Incidente QA)
 *  5. Configuración de Métodos de Pago Venezolanos (Pago Móvil / Transferencia)
 *  6. Flujo Completo de Préstamos (Dual Currency USD/VES, Fondeo, Pago, Devolución)
 *  7. Motor de Recordatorios Push de Vencimiento
 *  8. Regla de Capacidad Máxima de Miembros por Mutual (HTTP 409)
 *  9. Guardrails de Seguridad y Módulos en Desarrollo (Fondos Comunes)
 * ==============================================================================
 */

import assert from 'node:assert/strict';

// Colores ANSI para terminal
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Configuración de ejecución
const args = process.argv.slice(2);
const targetArg = args.find(a => a.startsWith('--target='));
const API_BASE = targetArg 
  ? targetArg.split('=')[1].replace(/\/+$/, '')
  : (process.env.QA_API_URL || 'https://mutualfam-qa-backend.fly.dev/api/v1').replace(/\/+$/, '');

const VERBOSE = args.includes('--verbose') || args.includes('-v');

console.log(`${c.bold}${c.cyan}====================================================================${c.reset}`);
console.log(`${c.bold}${c.cyan}   🧪 MUTUALFAM - SUITE DE PRUEBAS AUTOMATIZADAS QA (PRE-PRODUCCIÓN)  ${c.reset}`);
console.log(`${c.bold}${c.cyan}====================================================================${c.reset}`);
console.log(`${c.dim}Objetivo:${c.reset}  ${c.bold}${API_BASE}${c.reset}`);
console.log(`${c.dim}Fecha:${c.reset}     ${new Date().toISOString()}`);
console.log(`${c.dim}Modo:${c.reset}      E2E End-to-End Suite & Pre-Production Certification\n`);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const results = [];

async function runTest(suiteName, testName, testFn) {
  totalTests++;
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    passedTests++;
    results.push({ suite: suiteName, name: testName, status: 'PASSED', duration });
    console.log(`  ${c.green}✔ PASS${c.reset} ${c.bold}${testName}${c.reset} ${c.dim}(${duration}ms)${c.reset}`);
  } catch (err) {
    const duration = Date.now() - start;
    failedTests++;
    results.push({ suite: suiteName, name: testName, status: 'FAILED', duration, error: err.message });
    console.log(`  ${c.red}✖ FAIL${c.reset} ${c.bold}${testName}${c.reset} ${c.dim}(${duration}ms)${c.reset}`);
    console.log(`         ${c.red}${err.message}${c.reset}`);
    if (VERBOSE && err.stack) {
      console.log(`${c.dim}${err.stack}${c.reset}`);
    }
  }
}

// Helpers HTTP
async function apiPost(endpoint, body, token = null, orgId = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (orgId) headers['X-Organization-ID'] = String(orgId);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function apiGet(endpoint, token = null, orgId = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (orgId) headers['X-Organization-ID'] = String(orgId);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function apiFormLogin(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// Contexto compartido entre tests
const ctx = {
  founderToken: null,
  funderToken: null,
  borrowerToken: null,
  thirdPartyToken: null,
  extraUserTokens: [],
  org1Id: null,
  org2Id: null,
  singleUseInviteToken: null,
  createdLoanId: null,
  contributionId: null,
  repaymentId: null,
};

async function executeTestSuite() {
  // ============================================================================
  // FASE 0: Inicialización y Puesta a Punto del Sandbox QA
  // ============================================================================
  console.log(`${c.bold}${c.yellow}⚙️  FASE 0: Preparación y Limpieza del Entorno Sandbox QA...${c.reset}`);
  const resetRes = await fetch(`${API_BASE}/sandbox/reset-all`, { method: 'POST' }).then(r => r.json()).catch(() => ({}));
  if (resetRes.status === 'success') {
    console.log(`   ${c.green}✔ Base de datos de QA reiniciada a estado limpio (0 organizaciones, 0 usuarios).${c.reset}\n`);
  } else {
    console.log(`   ${c.yellow}ℹ Entorno listo sin reinicio previo.${c.reset}\n`);
  }

  // ============================================================================
  // SUITE 1: Configuración, Límites y Detección de Entorno QA
  // ============================================================================
  console.log(`${c.bold}${c.magenta}▶ MÓDULO 1: Configuración Global, Límites y Entorno QA${c.reset}`);

  await runTest('Config', 'GET /config/ debe retornar parámetros válidos de QA y tasa BCV activa', async () => {
    const { status, data } = await apiGet('/config/');
    assert.equal(status, 200, `Status esperado 200, recibido ${status}`);
    assert.equal(data.currency, 'USD', 'Moneda principal debe ser USD');
    assert.equal(data.local_currency, 'VES', 'Moneda local debe ser VES');
    assert.ok(typeof data.bcv_rate === 'number' && data.bcv_rate > 0, 'bcv_rate debe ser un número positivo');
    assert.ok(Array.isArray(data.banks) && data.banks.length >= 25, 'Debe incluir catálogo de bancos venezolanos (>=25)');
    assert.ok(data.limits, 'Debe incluir objeto de límites');
    assert.equal(data.limits.max_members_per_mutual, 5, 'Límite QA max miembros debe ser 5');
    assert.equal(data.limits.extra_mutuals_first_mutual, 1, 'Límite QA mutuales extra debe ser 1');
  });

  await runTest('Config', 'GET /config/limits debe retornar límites y contacto de soporte', async () => {
    const { status, data } = await apiGet('/config/limits');
    assert.equal(status, 200);
    assert.equal(data.contact_email, 'mutualfam@gmail.com', 'Email de soporte debe ser mutualfam@gmail.com');
    assert.equal(data.extra_mutuals_first_mutual, 1, 'Máximo 1 mutual adicional');
  });

  await runTest('Config', 'GET /config/phase debe certificar fase Beta en QA', async () => {
    const { status, data } = await apiGet('/config/phase');
    assert.equal(status, 200);
    assert.equal(data.is_beta, true, 'En QA is_beta debe ser true');
    assert.equal(data.phase_label, 'Beta', 'Etiqueta debe ser Beta');
  });

  await runTest('Config', 'GET /config/firebase-tester-url debe responder con enlaces de distribución', async () => {
    const { status, data } = await apiGet('/config/firebase-tester-url');
    assert.equal(status, 200);
    assert.ok(data.url !== undefined, 'Debe incluir campo url');
  });

  // ============================================================================
  // SUITE 2: Autenticación, Tokens JWT, Refresh y Perfiles de Usuario
  // ============================================================================
  console.log(`\n${c.bold}${c.magenta}▶ MÓDULO 2: Autenticación, JWT y Manejo de Sesión${c.reset}`);

  await runTest('Auth', 'POST /membership/register registra al Fundador Oficial (Jorge Rojas)', async () => {
    const { status, data } = await apiPost('/membership/register', {
      email: 'jorgerojasve@gmail.com',
      password: 'Password123!',
      first_name: 'Jorge',
      last_name: 'Rojas',
      phone: '04121112233',
    });
    assert.equal(status, 200);
    assert.ok(data.user_id, 'Debe retornar user_id');
  });

  await runTest('Auth', 'POST /membership/register rechaza registro duplicado con mismo email (HTTP 400)', async () => {
    const { status, data } = await apiPost('/membership/register', {
      email: 'jorgerojasve@gmail.com',
      password: 'OtraPassword123!',
      first_name: 'Jorge',
      last_name: 'Duplicado',
    });
    assert.equal(status, 400);
    assert.equal(data.detail, 'El email ya está registrado');
  });

  await runTest('Auth', 'POST /auth/login con credenciales del fundador emite tokens JWT válidos', async () => {
    const { status, data } = await apiFormLogin('jorgerojasve@gmail.com', 'Password123!');
    assert.equal(status, 200);
    assert.ok(data.access_token, 'Debe retornar access_token');
    assert.ok(data.refresh_token, 'Debe retornar refresh_token');
    assert.equal(data.token_type, 'bearer');
    ctx.founderToken = data.access_token;
  });

  await runTest('Auth', 'POST /auth/login rechaza credenciales incorrectas con HTTP 401', async () => {
    const { status, data } = await apiFormLogin('jorgerojasve@gmail.com', 'clave_invalida_999');
    assert.equal(status, 401);
    assert.equal(data.detail, 'Email o contraseña incorrectos');
  });

  await runTest('Auth', 'POST /auth/refresh emite nuevo access_token con refresh_token válido', async () => {
    const loginRes = await apiFormLogin('jorgerojasve@gmail.com', 'Password123!');
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${loginRes.data.refresh_token}` },
    });
    assert.equal(refreshRes.status, 200);
    const data = await refreshRes.json();
    assert.ok(data.access_token, 'Debe retornar nuevo access_token');
  });

  await runTest('Auth', 'GET /membership/me retorna datos de perfil y organizaciones', async () => {
    const { status, data } = await apiGet('/membership/me', ctx.founderToken);
    assert.equal(status, 200);
    assert.equal(data.email, 'jorgerojasve@gmail.com');
    assert.equal(data.first_name, 'Jorge');
    assert.equal(data.last_name, 'Rojas');
    assert.ok(Array.isArray(data.organizations));
  });

  await runTest('Auth', 'Registrar usuarios adicionales de prueba (Maira, Martín, Nora y Nilso)', async () => {
    const users = [
      { email: 'mairasq299@gmail.com', pw: 'Password123!', fn: 'Maira', ln: 'Salazar' },
      { email: 'martinvieira09@gmail.com', pw: 'Password123!', fn: 'Martín', ln: 'Vieira' },
      { email: 'norasalazar@test.com', pw: 'Password123!', fn: 'Nora', ln: 'Salazar' },
      { email: 'nilsosalazar@test.com', pw: 'Password123!', fn: 'Nilso Rafael', ln: 'Salazar' },
      { email: 'usuario_extra@test.com', pw: 'Password123!', fn: 'Extra', ln: 'Pruebas' },
    ];

    for (const u of users) {
      const reg = await apiPost('/membership/register', { email: u.email, password: u.pw, first_name: u.fn, last_name: u.ln });
      assert.equal(reg.status, 200);
      const log = await apiFormLogin(u.email, u.pw);
      assert.equal(log.status, 200);
      if (u.fn === 'Maira') ctx.funderToken = log.data.access_token;
      if (u.fn === 'Martín') ctx.borrowerToken = log.data.access_token;
      if (u.fn === 'Nora') ctx.thirdPartyToken = log.data.access_token;
      ctx.extraUserTokens.push(log.data.access_token);
    }
  });

  await runTest('Auth', 'POST /membership/push-token permite registrar token de notificaciones', async () => {
    const { status, data } = await apiPost('/membership/push-token', {
      token: 'ExponentPushToken[qa_device_test_token_sample]',
    }, ctx.founderToken);
    assert.equal(status, 200);
    assert.ok(data.message.includes('exitosamente'));
  });

  // ============================================================================
  // SUITE 3: Creación de Mutuales y Reglas de Límites (Regla 1)
  // ============================================================================
  console.log(`\n${c.bold}${c.magenta}▶ MÓDULO 3: Creación de Mutuales y Reglas de Límites (Regla 1)${c.reset}`);

  await runTest('Limits', 'Bootstrap: El primer usuario crea la primera mutual (Org 1)', async () => {
    const { status, data } = await apiPost('/membership/organizations/create', {
      name: 'Familia Rojas Salazar',
      description: 'Primera mutual familiar oficial',
    }, ctx.founderToken);
    assert.equal(status, 200);
    assert.ok(data.organization_id);
    ctx.org1Id = data.organization_id;
  });

  await runTest('Limits', 'Regla 1: Miembro de la primera mutual puede crear 1 mutual adicional (Org 2)', async () => {
    const { status, data } = await apiPost('/membership/organizations/create', {
      name: 'Segunda Mutual Permitida',
      description: 'Mutual adicional dentro del cupo permitido',
    }, ctx.founderToken);
    assert.equal(status, 200);
    assert.ok(data.organization_id);
    ctx.org2Id = data.organization_id;
  });

  await runTest('Limits', 'Regla 1: Intentar crear una tercera mutual excede el límite y es bloqueado con HTTP 403', async () => {
    const { status, data } = await apiPost('/membership/organizations/create', {
      name: 'Tercera Mutual Bloqueada',
      description: 'Debe ser bloqueada por exceder límite de 1 adicional',
    }, ctx.founderToken);
    assert.equal(status, 403);
    assert.equal(data.detail.code, 'LIMIT_MUTUALS');
    assert.ok(data.detail.message.includes('Has alcanzado el límite permitido de mutuales adicionales creadas'));
    assert.equal(data.detail.contact_email, 'mutualfam@gmail.com');
  });

  await runTest('Limits', 'Regla 1: Usuario ajeno a la primera mutual es bloqueado con HTTP 403', async () => {
    const { status, data } = await apiPost('/membership/organizations/create', {
      name: 'Intento Usuario Ajeno',
    }, ctx.thirdPartyToken);
    assert.equal(status, 403);
    assert.equal(data.detail.code, 'LIMIT_MUTUALS');
    assert.ok(data.detail.message.includes('Solo los miembros de la primera mutual pueden crear una nueva mutual'));
  });

  // ============================================================================
  // SUITE 4: Invitaciones de Un Solo Uso y Blindaje Anti-Duplicados
  // ============================================================================
  console.log(`\n${c.bold}${c.magenta}▶ MÓDULO 4: Invitaciones de Un Solo Uso y Blindaje Anti-Duplicados${c.reset}`);

  await runTest('Invites', 'POST /membership/organizations/{id}/invites genera código alfanumérico único', async () => {
    const { status, data } = await apiPost(`/membership/organizations/${ctx.org1Id}/invites`, null, ctx.founderToken, ctx.org1Id);
    assert.equal(status, 200);
    assert.ok(data.token);
    assert.equal(data.token.length, 8, 'Token debe ser de 8 caracteres alfanuméricos');
    assert.ok(data.code.includes('-'), 'Código formateado debe tener guión');
    assert.ok(data.expires_at, 'Debe incluir fecha de expiración');
    ctx.singleUseInviteToken = data.token;
  });

  await runTest('Invites', 'GET /membership/invites/{token} retorna información pública de la mutual activa', async () => {
    const { status, data } = await apiGet(`/membership/invites/${ctx.singleUseInviteToken}`);
    assert.equal(status, 200);
    assert.equal(data.organization_name, 'Familia Rojas Salazar');
    assert.equal(data.token, ctx.singleUseInviteToken);
    assert.equal(data.member_count, 1, 'Inicialmente solo el fundador');
    assert.equal(data.max_members, 5, 'Límite máximo 5');
  });

  await runTest('Invites', 'Primer usuario (Martín Vieira) se une exitosamente con el código de invitación', async () => {
    const { status, data } = await apiPost('/membership/organizations/join', {
      token: ctx.singleUseInviteToken,
    }, ctx.borrowerToken);
    assert.equal(status, 200);
    assert.equal(data.organization_id, ctx.org1Id);
    assert.ok(data.message.includes('exitosamente'));
  });

  await runTest('Invites', 'Idempotencia: El mismo usuario que ya pertenece recibe respuesta amigable', async () => {
    const { status, data } = await apiPost('/membership/organizations/join', {
      token: ctx.singleUseInviteToken,
    }, ctx.borrowerToken);
    assert.equal(status, 200);
    assert.equal(data.message, 'Ya eres miembro de esta mutual');
  });

  await runTest('Invites [INCIDENTE QA]', 'GET /membership/invites/{token} RECHAZA con 400 código ya utilizado', async () => {
    const { status, data } = await apiGet(`/membership/invites/${ctx.singleUseInviteToken}`);
    assert.equal(status, 400);
    assert.ok(data.detail.includes('ya fue utilizada por otra persona'));
    assert.ok(data.detail.includes('fundador'));
  });

  await runTest('Invites [INCIDENTE QA]', 'POST /organizations/join RECHAZA segundo usuario con código duplicado (HTTP 400)', async () => {
    const { status, data } = await apiPost('/membership/organizations/join', {
      token: ctx.singleUseInviteToken,
    }, ctx.thirdPartyToken);
    assert.equal(status, 400);
    assert.equal(
      data.detail,
      'Esta invitación ya fue utilizada por otra persona. Comunícate con el fundador de la mutual para que te genere una nueva invitación.'
    );
  });

  await runTest('Invites', 'Unir a Maira Salazar a Org 1 mediante nueva invitación única', async () => {
    const inviteRes = await apiPost(`/membership/organizations/${ctx.org1Id}/invites`, null, ctx.founderToken, ctx.org1Id);
    assert.equal(inviteRes.status, 200);
    const joinRes = await apiPost('/membership/organizations/join', { token: inviteRes.data.token }, ctx.funderToken);
    assert.equal(joinRes.status, 200);
  });

  await runTest('Membership', 'GET /membership/members lista los 3 miembros actuales de Org 1', async () => {
    const { status, data } = await apiGet('/membership/members', ctx.founderToken, ctx.org1Id);
    assert.equal(status, 200);
    assert.equal(data.length, 3, 'Debe haber 3 miembros: Jorge, Martín y Maira');
    const founder = data.find(m => m.role === 'founder');
    assert.ok(founder && founder.first_name === 'Jorge');
  });

  // ============================================================================
  // SUITE 5: Configuración de Métodos de Pago Venezolanos
  // ============================================================================
  console.log(`\n${c.bold}${c.magenta}▶ MÓDULO 5: Métodos de Pago Venezolanos y Validaciones Previas${c.reset}`);

  await runTest('Payments', 'Solicitar préstamo sin métodos de pago debe ser rechazado con HTTP 400', async () => {
    const { status, data } = await apiPost('/loans/', {
      amount_usd: 50.0,
      motive: 'Intento sin pago',
      accepted_payment_methods: ['Pago Móvil'],
    }, ctx.borrowerToken, ctx.org1Id);
    assert.equal(status, 400);
    assert.ok(data.detail.includes('Debes cargar por lo menos un dato de pago'));
  });

  await runTest('Payments', 'Configurar Pago Móvil y Cuenta Bancaria del prestatario (Martín)', async () => {
    const paymentMethods = {
      'Pago Móvil': { banco: '0105', cedula: 'V-18765432', telefono: '04141234567' },
      'Transferencia': '01050111223344556677',
    };
    const { status } = await apiPost('/config/payment_methods', {
      payment_methods_json: JSON.stringify(paymentMethods),
    }, ctx.borrowerToken, ctx.org1Id);
    assert.equal(status, 200);

    const getRes = await apiGet('/config/payment_methods', ctx.borrowerToken, ctx.org1Id);
    assert.equal(getRes.status, 200);
    const parsed = JSON.parse(getRes.data.payment_methods_json);
    assert.equal(parsed['Pago Móvil'].banco, '0105');
  });

  await runTest('Payments', 'Configurar Pago Móvil de la aportante (Maira)', async () => {
    const paymentMethods = {
      'Pago Móvil': { banco: '0102', cedula: 'V-15987654', telefono: '04127654321' },
    };
    const { status } = await apiPost('/config/payment_methods', {
      payment_methods_json: JSON.stringify(paymentMethods),
    }, ctx.funderToken, ctx.org1Id);
    assert.equal(status, 200);
  });

  // ============================================================================
  // SUITE 6: Flujo Completo de Préstamos (Doble Moneda y Ciclo de Vida)
  // ============================================================================
  console.log(`\n${c.bold}${c.magenta}▶ MÓDULO 6: Ciclo Completo de Préstamos (USD/VES, Fondeo y Devolución)${c.reset}`);

  await runTest('Loans', 'POST /loans/ crea solicitud de préstamo en USD con fecha de devolución estimada', async () => {
    const { status, data } = await apiPost('/loans/', {
      amount_usd: 25.0,
      motive: 'Reparación de teléfono móvil familiar (E2E Test)',
      estimated_repayment_date: '2026-11-25',
      accepted_payment_methods: ['Pago Móvil'],
    }, ctx.borrowerToken, ctx.org1Id);
    assert.equal(status, 200);
    assert.ok(data.id);
    assert.equal(data.amount_usd, 25.0);
    assert.equal(data.status, 'pending');
    assert.ok(data.requester_name.includes('Martín'));
    ctx.createdLoanId = data.id;
  });

  await runTest('Loans', 'GET /loans/ lista los préstamos de la mutual con métodos de pago adjuntos', async () => {
    const { status, data } = await apiGet('/loans/', ctx.funderToken, ctx.org1Id);
    assert.equal(status, 200);
    const loan = data.find(l => l.id === ctx.createdLoanId);
    assert.ok(loan);
    assert.equal(loan.amount_usd, 25.0);
    assert.ok(loan.requester_payment_methods_json.includes('0105'));
  });

  await runTest('Loans', 'POST /loans/{id}/contribute compromete aporte completo ($25) por Maira', async () => {
    const { status, data } = await apiPost(`/loans/${ctx.createdLoanId}/contribute`, {
      amount_usd: 25.0,
    }, ctx.funderToken, ctx.org1Id);
    assert.equal(status, 200);
    assert.ok(data.contribution_id);
    ctx.contributionId = data.contribution_id;
  });

  await runTest('Loans', 'POST /loans/contributions/{id}/notify_payment aportante notifica transferencia', async () => {
    const { status, data } = await apiPost(`/loans/contributions/${ctx.contributionId}/notify_payment`, {
      payment_method: 'Pago Móvil',
      reference_text: 'REF-PAGOMOVIL-QA-554433',
    }, ctx.funderToken, ctx.org1Id);
    assert.equal(status, 200);
    assert.ok(data.message.includes('exitosamente'));
  });

  await runTest('Loans', 'POST /loans/contributions/{id}/verify_payment prestatario confirma recepción', async () => {
    const { status, data } = await apiPost(`/loans/contributions/${ctx.contributionId}/verify_payment`, null, ctx.borrowerToken, ctx.org1Id);
    assert.equal(status, 200);
    assert.ok(data.message.includes('exitosamente'));
  });

  await runTest('Loans', 'POST /loans/contributions/{id}/repay prestatario realiza devolución del préstamo', async () => {
    const { status, data } = await apiPost(`/loans/contributions/${ctx.contributionId}/repay`, {
      amount_usd: 25.0,
      payment_method: 'Pago Móvil',
      reference_text: 'REF-DEVOLUCION-QA-889911',
    }, ctx.borrowerToken, ctx.org1Id);
    assert.equal(status, 200);
    assert.ok(data.message.includes('exitosamente'));
  });

  await runTest('Loans', 'POST /loans/repayments/{id}/verify aportante verifica devolución y salda préstamo', async () => {
    const { data: loansList } = await apiGet('/loans/', ctx.funderToken, ctx.org1Id);
    const loan = loansList.find(l => l.id === ctx.createdLoanId);
    assert.ok(loan);
    const contrib = loan.contributions.find(c => c.id === ctx.contributionId);
    assert.ok(contrib && contrib.repayments.length > 0);
    const repay = contrib.repayments[0];

    const { status, data } = await apiPost(`/loans/repayments/${repay.id}/verify`, null, ctx.funderToken, ctx.org1Id);
    assert.equal(status, 200);
    assert.ok(data.message.includes('exitosamente'));

    // Verificamos que el préstamo pasa a estado 'repaid'
    const { data: updatedList } = await apiGet('/loans/', ctx.funderToken, ctx.org1Id);
    const finalLoan = updatedList.find(l => l.id === ctx.createdLoanId);
    assert.equal(finalLoan.status, 'repaid', 'El estado del préstamo debe ser repaid');
  });

  await runTest('Loans', 'POST /loans/check-reminders ejecuta motor de recordatorios de vencimiento', async () => {
    const { status, data } = await apiPost('/loans/check-reminders', null);
    assert.equal(status, 200);
    assert.equal(data.status, 'ok');
    assert.ok(typeof data.evaluated_loans === 'number');
  });

  // ============================================================================
  // SUITE 7: Regla 2 - Límite Máximo de Capacidad de Miembros (HTTP 409)
  // ============================================================================
  console.log(`\n${c.bold}${c.magenta}▶ MÓDULO 7: Regla de Capacidad Máxima de Miembros (Regla 2)${c.reset}`);

  await runTest('Capacity', 'Llenar la mutual Org 1 hasta el cupo máximo de 5 miembros en QA', async () => {
    // Ya tenemos 3 miembros (Jorge, Martín, Maira). Agregamos a Nora (4) y Nilso (5)
    const inv1 = await apiPost(`/membership/organizations/${ctx.org1Id}/invites`, null, ctx.founderToken, ctx.org1Id);
    assert.equal(inv1.status, 200);
    const join1 = await apiPost('/membership/organizations/join', { token: inv1.data.token }, ctx.thirdPartyToken);
    assert.equal(join1.status, 200);

    const inv2 = await apiPost(`/membership/organizations/${ctx.org1Id}/invites`, null, ctx.founderToken, ctx.org1Id);
    assert.equal(inv2.status, 200);
    const join2 = await apiPost('/membership/organizations/join', { token: inv2.data.token }, ctx.extraUserTokens[3]);
    assert.equal(join2.status, 200);

    const { data: members } = await apiGet('/membership/members', ctx.founderToken, ctx.org1Id);
    assert.equal(members.length, 5, 'La mutual debe tener exactamente 5 miembros (cupo completo)');
  });

  await runTest('Capacity [REGLA 2]', 'Intentar emitir invitación cuando la mutual está llena debe ser bloqueado con HTTP 409', async () => {
    const { status, data } = await apiPost(`/membership/organizations/${ctx.org1Id}/invites`, null, ctx.founderToken, ctx.org1Id);
    assert.equal(status, 409, 'Debe retornar HTTP 409');
    assert.equal(data.detail.code, 'LIMIT_MEMBERS');
    assert.ok(data.detail.message.includes('ya cuenta con el número máximo de 5 miembros permitidos'));
  });

  // ============================================================================
  // SUITE 8: Guardrails de Seguridad y Módulos en Desarrollo
  // ============================================================================
  console.log(`\n${c.bold}${c.magenta}▶ MÓDULO 8: Guardrails de Seguridad y Módulos en Desarrollo${c.reset}`);

  await runTest('Funds', 'POST /funds/ responde con control seguro de funcionalidad en desarrollo', async () => {
    const { status, data } = await apiPost('/funds/', {
      name: 'Fondo de Emergencia Familiar',
      fund_type: 'emergency',
    }, ctx.founderToken, ctx.org1Id);
    assert.equal(status, 400);
    assert.ok(data.detail.includes('temporalmente deshabilitada'));
  });

  // ============================================================================
  // RESUMEN Y REPORTE FINAL
  // ============================================================================
  console.log(`\n${c.bold}${c.cyan}====================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}               📊 REPORTE DE RESULTADOS DE PRUEBAS QA               ${c.reset}`);
  console.log(`${c.bold}${c.cyan}====================================================================${c.reset}`);

  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`\nTotal Pruebas Ejecutadas: ${c.bold}${totalTests}${c.reset}`);
  console.log(`Pruebas Superadas:        ${c.green}${c.bold}${passedTests}${c.reset}`);
  console.log(`Pruebas Fallidas:         ${failedTests === 0 ? c.green + '0' : c.red + c.bold + failedTests}${c.reset}`);
  console.log(`Tasa de Éxito:            ${passRate === '100.0' ? c.green : c.yellow}${c.bold}${passRate}%${c.reset}\n`);

  if (failedTests === 0) {
    console.log(`${c.bold}${c.green}🎉 ¡TODAS LAS FUNCIONALIDADES EN QA FUERON CERTIFICADAS EXITOSAMENTE (100%)!${c.reset}`);
    console.log(`${c.green}✔ El entorno de QA cumple con todos los criterios de aceptación para el pase a Producción.${c.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${c.bold}${c.red}⚠️ SE DETECTARON FALLOS EN ${failedTests} PRUEBA(S).${c.reset}`);
    console.log(`${c.red}Revisa los mensajes de error antes de autorizar el pase a Producción.${c.reset}\n`);
    process.exit(1);
  }
}

executeTestSuite().catch((err) => {
  console.error(`\n${c.red}${c.bold}Error crítico en el runner de pruebas:${c.reset}`, err);
  process.exit(1);
});
