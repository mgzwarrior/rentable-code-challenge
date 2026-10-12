import csv
from decimal import Decimal

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from api.models import Tenant, Transaction
from api.serializers import TenantSerializer, TransactionSerializer

# Create your views here.

def build_ledger(tenant):
    """
    Returns the tenant's transactions in date order, each paired with the
    running balance after it, along with the totals by type and the balance.
    """
    totals = {Transaction.CHARGE: Decimal('0.00'), Transaction.PAYMENT: Decimal('0.00')}
    balance = Decimal('0.00')
    rows = []
    for transaction in tenant.transactions.order_by('date', 'id'):
        balance += transaction.signed_amount
        totals[transaction.type] += transaction.amount
        rows.append((transaction, balance))
    return rows, totals, balance

def csv_text(value):
    """
    Returns text that is safe to open in a spreadsheet. A leading =, +, - or @
    would otherwise be run as a formula.
    """
    text = '' if value is None else str(value)
    if text.startswith(('=', '+', '-', '@', '\t', '\r')):
        return "'" + text
    return text

@api_view(['GET'])
def welcome_message(request):
    """
    A simple view to test the API.
    """
    return Response({'message': 'Welcome to the Rentable Code Challenge!'})

@api_view(['GET'])
def tenant_list(request):
    """
    Returns a list of all tenants with their balance.
    A positive balance is the amount the tenant owes.
    """
    tenants = []
    for tenant in Tenant.objects.prefetch_related('transactions'):
        entry = TenantSerializer(tenant).data
        entry['balance'] = str(sum(
            (transaction.signed_amount for transaction in tenant.transactions.all()),
            Decimal('0.00'),
        ))
        tenants.append(entry)
    return Response(tenants)

@api_view(['GET'])
def transaction_list(request):
    """
    Returns a list of transactions, optionally filtered by tenant.
    """
    transactions = Transaction.objects.all()
    tenant_id = request.query_params.get('tenant')
    if tenant_id is not None:
        try:
            transactions = transactions.filter(tenant_id=int(tenant_id))
        except ValueError:
            return Response({'tenant': 'Must be a tenant ID.'}, status=status.HTTP_400_BAD_REQUEST)
    serializer = TransactionSerializer(transactions, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def tenant_ledger(request, tenant_id):
    """
    Returns a tenant's transactions in date order with a running balance,
    along with the tenant's total charges, total payments and balance.
    A positive balance is the amount the tenant owes.
    """
    tenant = get_object_or_404(Tenant, id=tenant_id)
    rows, totals, balance = build_ledger(tenant)
    entries = []
    for transaction, running_balance in rows:
        entry = TransactionSerializer(transaction).data
        entry['running_balance'] = str(running_balance)
        entries.append(entry)
    return Response({
        'tenant': TenantSerializer(tenant).data,
        'total_charges': str(totals[Transaction.CHARGE]),
        'total_payments': str(totals[Transaction.PAYMENT]),
        'balance': str(balance),
        'transactions': entries,
    })

@api_view(['GET'])
def tenant_ledger_export(request, tenant_id):
    """
    Returns a tenant's ledger as a CSV file for use in a spreadsheet.
    Amounts are plain numbers so they can be summed.
    """
    tenant = get_object_or_404(Tenant, id=tenant_id)
    rows, _, _ = build_ledger(tenant)

    filename = f'ledger-{slugify(tenant.name)}.csv'
    if tenant.pms_tenant_id is not None:
        filename = f'ledger-pms-{tenant.pms_tenant_id}-{slugify(tenant.name)}.csv'
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow([
        'PMS Tenant ID', 'Tenant', 'Unit', 'Date', 'PMS Transaction ID',
        'Description', 'Charge', 'Payment', 'Balance',
    ])
    for transaction, running_balance in rows:
        is_charge = transaction.type == Transaction.CHARGE
        writer.writerow([
            '' if tenant.pms_tenant_id is None else tenant.pms_tenant_id,
            csv_text(tenant.name),
            csv_text(tenant.unit),
            transaction.date.isoformat(),
            csv_text(transaction.pms_transaction_id),
            csv_text(transaction.description),
            transaction.amount if is_charge else '',
            '' if is_charge else transaction.amount,
            running_balance,
        ])
    return response
