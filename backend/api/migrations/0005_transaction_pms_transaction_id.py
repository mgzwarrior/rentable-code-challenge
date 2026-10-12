from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_tenant_pms_tenant_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='pms_transaction_id',
            field=models.CharField(default='', max_length=64, unique=True),
            preserve_default=False,
        ),
    ]
