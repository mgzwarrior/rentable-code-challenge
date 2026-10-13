from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from api.models import Transaction, Tenant
import argparse
import requests
from datetime import datetime

class Command(BaseCommand):
    help = 'Imports transaction data from the integration API into the Django database.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--include-ledgers',
            action=argparse.BooleanOptionalAction,
            default=True,
            help='Include tenant ledgers in the PMS request (default: true).',
        )

    def handle(self, *args, **options):
        self.stdout.write('Starting transaction import...')

        integration_api_url = "https://kpsaflrfjmhwomxiqrtiplvqem0hfmec.lambda-url.us-east-2.on.aws/api/simulated-pms-integration-api/tenants/"
        try:
            response = requests.get(
                integration_api_url,
                params={'includeLedgers': str(options['include_ledgers']).lower()},
                timeout=30,
            )
            response.raise_for_status()
            tenants_data = response.json()
        except requests.exceptions.RequestException as e:
            raise CommandError(f'Error fetching data from integration API: {e}')

        transaction_count = 0
        with transaction.atomic():
            for tenant_data in tenants_data:
                tenant_id = tenant_data.get('tenant_id')
                tenant = (
                    Tenant.objects.filter(pms_tenant_id=tenant_id).first()
                    or Tenant.objects.filter(pms_tenant_id__isnull=True, name=tenant_data.get('name')).first()
                    or Tenant()
                )
                tenant.pms_tenant_id = tenant_id
                tenant.name = tenant_data.get('name')
                tenant.unit = tenant_data.get('unit')
                tenant.save()

                for transaction_data in tenant_data.get('ledger', []):
                    Transaction.objects.update_or_create(
                        pms_transaction_id=transaction_data.get('id'),
                        defaults={
                            'tenant': tenant,
                            'date': datetime.strptime(transaction_data.get('date'), '%Y-%m-%d').date(),
                            'type': transaction_data.get('type'),
                            'description': transaction_data.get('description'),
                            'amount': transaction_data.get('amount'),
                        }
                    )
                    transaction_count += 1
        self.stdout.write(f'Successfully imported {transaction_count} transactions for {len(tenants_data)} tenants.') 