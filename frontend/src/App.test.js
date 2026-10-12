import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

const tenants = [
    { id: 1, name: 'Alice Wonderland', unit: 'A101', pms_tenant_id: 1, balance: '0.00' },
    { id: 4, name: 'Daisy Ridley', unit: 'C303', pms_tenant_id: 3, balance: '1300.00' },
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

test('the tenant search is kept when returning from a ledger', async () => {
    render(<App />);

    await screen.findByText('Alice Wonderland');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tenants' }), { target: { value: 'daisy' } });
    fireEvent.click(screen.getByRole('button', { name: 'View Ledger' }));
    await screen.findByText('Rent Charge - January');
    fireEvent.click(screen.getByRole('button', { name: 'Back to tenants' }));

    expect(await screen.findByText('Daisy Ridley')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search tenants' })).toHaveValue('daisy');
    expect(screen.queryByText('Alice Wonderland')).not.toBeInTheDocument();
});

test('the tenant sort is kept when returning from a ledger', async () => {
    render(<App />);

    await screen.findByText('Alice Wonderland');
    fireEvent.click(screen.getByRole('button', { name: 'Balance' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'View Ledger' })[0]);
    await screen.findByText('Rent Charge - January');
    expect(global.fetch).toHaveBeenLastCalledWith('/api/tenants/4/ledger/');
    fireEvent.click(screen.getByRole('button', { name: 'Back to tenants' }));

    await screen.findByText('Alice Wonderland');
    const names = screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[1].textContent);
    expect(names).toEqual(['Daisy Ridley', 'Alice Wonderland']);
    expect(screen.getByRole('columnheader', { name: /Balance/ })).toHaveAttribute('aria-sort', 'descending');
});

test('hiding settled accounts is kept when returning from a ledger', async () => {
    render(<App />);

    await screen.findByText('Alice Wonderland');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide settled accounts' }));
    fireEvent.click(screen.getByRole('button', { name: 'View Ledger' }));
    await screen.findByText('Rent Charge - January');
    fireEvent.click(screen.getByRole('button', { name: 'Back to tenants' }));

    expect(await screen.findByText('Daisy Ridley')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Hide settled accounts' })).toBeChecked();
    expect(screen.queryByText('Alice Wonderland')).not.toBeInTheDocument();
});
