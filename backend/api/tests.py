from decimal import Decimal

from django.test import TestCase

from api.models import Tenant, Transaction


class TenantLedgerTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name='Daisy Ridley', unit='C303', pms_tenant_id=3)
        self.next_pms_transaction_id = 1

    def add_transaction(self, date, type, amount, tenant=None, description='Test'):
        transaction = Transaction.objects.create(
            tenant=tenant or self.tenant,
            pms_transaction_id=str(self.next_pms_transaction_id),
            date=date,
            type=type,
            description=description,
            amount=Decimal(amount),
        )
        self.next_pms_transaction_id += 1
        return transaction

    def get_ledger(self, tenant=None):
        return self.client.get(f'/api/tenants/{(tenant or self.tenant).id}/ledger/')

    def test_empty_ledger_has_zero_balance(self):
        response = self.get_ledger()

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['tenant']['name'], 'Daisy Ridley')
        self.assertEqual(data['total_charges'], '0.00')
        self.assertEqual(data['total_payments'], '0.00')
        self.assertEqual(data['balance'], '0.00')
        self.assertEqual(data['transactions'], [])

    def test_balance_is_charges_minus_payments(self):
        self.add_transaction('2023-01-01', Transaction.CHARGE, '1300.00')
        self.add_transaction('2023-01-03', Transaction.PAYMENT, '1000.00')

        data = self.get_ledger().json()

        self.assertEqual(data['total_charges'], '1300.00')
        self.assertEqual(data['total_payments'], '1000.00')
        self.assertEqual(data['balance'], '300.00')

    def test_overpayment_gives_negative_balance(self):
        self.add_transaction('2023-01-01', Transaction.CHARGE, '100.00')
        self.add_transaction('2023-01-03', Transaction.PAYMENT, '150.00')

        self.assertEqual(self.get_ledger().json()['balance'], '-50.00')

    def test_negative_charge_is_a_credit_that_lowers_the_balance(self):
        self.add_transaction('2023-01-01', Transaction.CHARGE, '1300.00')
        self.add_transaction('2023-01-05', Transaction.CHARGE, '-80.00')

        data = self.get_ledger().json()

        self.assertEqual(data['total_charges'], '1220.00')
        self.assertEqual(data['balance'], '1220.00')

    def test_negative_payment_is_a_reversal_that_raises_the_balance(self):
        self.add_transaction('2023-01-01', Transaction.CHARGE, '1375.00')
        self.add_transaction('2023-01-01', Transaction.PAYMENT, '1375.00')
        self.add_transaction('2023-01-05', Transaction.PAYMENT, '-1375.00')

        data = self.get_ledger().json()

        self.assertEqual(data['total_payments'], '0.00')
        self.assertEqual(data['balance'], '1375.00')

    def test_transactions_are_in_date_order_with_a_running_balance(self):
        self.add_transaction('2023-02-01', Transaction.CHARGE, '500.00', description='Later')
        self.add_transaction('2023-01-01', Transaction.CHARGE, '1000.00', description='Earlier')
        self.add_transaction('2023-01-01', Transaction.PAYMENT, '400.00', description='Same day')

        transactions = self.get_ledger().json()['transactions']

        self.assertEqual(
            [(t['description'], t['running_balance']) for t in transactions],
            [('Earlier', '1000.00'), ('Same day', '600.00'), ('Later', '1100.00')],
        )

    def test_ledger_only_includes_the_requested_tenant(self):
        other_tenant = Tenant.objects.create(name='Bob The Builder', unit='B205', pms_tenant_id=2)
        self.add_transaction('2023-01-01', Transaction.CHARGE, '1300.00')
        self.add_transaction('2023-01-01', Transaction.CHARGE, '900.00', tenant=other_tenant)

        data = self.get_ledger().json()

        self.assertEqual(len(data['transactions']), 1)
        self.assertEqual(data['balance'], '1300.00')

    def test_unknown_tenant_returns_404(self):
        response = self.client.get('/api/tenants/999999/ledger/')

        self.assertEqual(response.status_code, 404)

    def test_unknown_transaction_type_fails_instead_of_guessing(self):
        self.add_transaction('2023-01-01', 'adjustment', '100.00')

        with self.assertRaises(ValueError):
            self.get_ledger()
