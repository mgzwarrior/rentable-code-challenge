import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

const tenants = [
    { id: 1, name: 'Alice Wonderland', unit: 'A101', pms_tenant_id: 1 },
    { id: 4, name: 'Daisy Ridley', unit: 'C303', pms_tenant_id: 3 },
];

const ledger = {
    tenant: tenants[1],
    total_charges: '1300.00',
    total_payments: '0.00',
    balance: '1300.00',
    transactions: [
        { id: 1, date: '2023-01-01', type: 'charge', description: 'Rent Charge - January', amount: '1300.00', running_balance: '1300.00' },
    ],
};

beforeEach(() => {
    global.fetch = jest.fn(url => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(url === '/api/tenants/' ? tenants : ledger),
    }));
});

test('View Ledger opens that tenant\'s ledger and Back returns to the tenant list', async () => {
    render(<App />);

    const row = await screen.findByRole('row', { name: /Daisy Ridley/ });
    fireEvent.click(within(row).getByRole('button', { name: 'View Ledger' }));

    expect(await screen.findByText('Rent Charge - January')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/tenants/4/ledger/');
    expect(screen.queryByText('Alice Wonderland')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to tenants' }));

    expect(await screen.findByText('Alice Wonderland')).toBeInTheDocument();
    expect(screen.queryByText('Rent Charge - January')).not.toBeInTheDocument();
});
