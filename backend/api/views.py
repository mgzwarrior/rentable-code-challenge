from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from api.models import Tenant, Transaction
from api.serializers import TenantSerializer, TransactionSerializer

# Create your views here.

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
    totals = {Transaction.CHARGE: Decimal('0.00'), Transaction.PAYMENT: Decimal('0.00')}
    balance = Decimal('0.00')
    entries = []
    for transaction in tenant.transactions.order_by('date', 'id'):
        balance += transaction.signed_amount
        totals[transaction.type] += transaction.amount
        entry = TransactionSerializer(transaction).data
        entry['running_balance'] = str(balance)
        entries.append(entry)
    return Response({
        'tenant': TenantSerializer(tenant).data,
        'total_charges': str(totals[Transaction.CHARGE]),
        'total_payments': str(totals[Transaction.PAYMENT]),
        'balance': str(balance),
        'transactions': entries,
    })
