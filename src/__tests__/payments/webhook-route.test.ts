import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  constructEventMock,
  validateSelectedDebtsMock,
  withTenantScopeMock,
  prismaMock,
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  validateSelectedDebtsMock: vi.fn(),
  withTenantScopeMock: vi.fn(),
  prismaMock: {
    onlinePayment: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    plata: {
      create: vi.fn(),
      update: vi.fn(),
    },
    plataDistributie: {
      create: vi.fn(),
    },
    impozit: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    document: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
  withTenantScope: withTenantScopeMock,
}));

vi.mock("@/lib/payments/selected-debts", () => ({
  validateSelectedDebtsForContribuabil: validateSelectedDebtsMock,
}));

import { POST } from "@/app/api/payments/webhook/route";

describe("POST /api/payments/webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    withTenantScopeMock.mockImplementation(async (_tenantId: string, callback: () => Promise<unknown>) => {
      return callback();
    });
  });

  it("rejects selected-debt confirmations when Stripe amount differs from persisted payment amount", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          payment_status: "paid",
          amount_total: 10000,
          metadata: {
            tenantId: "tenant-1",
            contribuabilId: "contrib-1",
          },
          payment_intent: "pi_123",
        },
      },
    });

    prismaMock.onlinePayment.findFirst.mockResolvedValueOnce(null);
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "payment-1",
          status: "pending",
          suma: 120,
          selectedDebts: [
            {
              impozitId: "550e8400-e29b-41d4-a716-446655440001",
              amount: 100,
            },
          ],
          contribuabilId: "contrib-1",
        },
      ])
      .mockResolvedValueOnce([{ stripeEventId: "evt_1" }])
      .mockResolvedValueOnce([{ id: "550e8400-e29b-41d4-a716-446655440001" }]);

    validateSelectedDebtsMock.mockResolvedValueOnce({
      items: [
        {
          impozitId: "550e8400-e29b-41d4-a716-446655440001",
          amount: 100,
          description: "Impozit cladiri 2026",
        },
      ],
      totalAmount: 100,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/payments/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: "{}",
      })
    );

    expect(response.status).toBe(500);
    expect(prismaMock.plata.create).not.toHaveBeenCalled();
    expect(validateSelectedDebtsMock).not.toHaveBeenCalled();
  });

  it("rejects selected-debt confirmations when validated debt total differs from persisted payment amount", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_2",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_2",
          payment_status: "paid",
          amount_total: 10000,
          metadata: {
            tenantId: "tenant-1",
            contribuabilId: "contrib-1",
          },
          payment_intent: "pi_456",
        },
      },
    });

    prismaMock.onlinePayment.findFirst.mockResolvedValueOnce(null);
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "payment-2",
          status: "pending",
          suma: 100,
          selectedDebts: [
            {
              impozitId: "550e8400-e29b-41d4-a716-446655440001",
              amount: 100,
            },
          ],
          contribuabilId: "contrib-1",
        },
      ])
      .mockResolvedValueOnce([{ stripeEventId: "evt_2" }])
      .mockResolvedValueOnce([{ id: "550e8400-e29b-41d4-a716-446655440001" }]);

    validateSelectedDebtsMock.mockResolvedValueOnce({
      items: [
        {
          impozitId: "550e8400-e29b-41d4-a716-446655440001",
          amount: 90,
          description: "Impozit cladiri 2026",
        },
      ],
      totalAmount: 90,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/payments/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: "{}",
      })
    );

    expect(response.status).toBe(500);
    expect(prismaMock.plata.create).not.toHaveBeenCalled();
    expect(validateSelectedDebtsMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      contribuabilId: "contrib-1",
      items: [
        {
          impozitId: "550e8400-e29b-41d4-a716-446655440001",
          amount: 100,
        },
      ],
    });
  });
});
