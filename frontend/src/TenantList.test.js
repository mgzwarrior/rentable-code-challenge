import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import TenantList from './TenantList';

const tenants = [
    { id: 1, name: 'Alice Wonderland', unit: 'A101', pms_tenant_id: 1, balance: '0.00' },
    { id: 3, name: 'Charlie Chaplin', unit: 'C303', pms_tenant_id: null, balance: '0.00' },
    { id: 4, name: 'Daisy Ridley', unit: 'C303', pms_tenant_id: 3, balance: '1240.10' },
    { id: 63, name: 'Yuki Anderson', unit: 'B516', pms_tenant_id: 62, balance: '-550.00' },
    { id: 2, name: 'Bob The Builder', unit: 'B205', pms_tenant_id: 2, balance: '2425.20' },
];

beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tenants) }));
});

function SearchableTenantList() {
    const [search, setSearch] = useState('');
    return <TenantList onViewLedger={() => {}} search={search} onSearchChange={setSearch} />;
}

async function renderAndSearch(text) {
    render(<SearchableTenantList />);
    await screen.findByText('Alice Wonderland');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tenants' }), { target: { value: text } });
}

function cellsFor(row) {
    return within(row).getAllByRole('cell').map(cell => cell.textContent);
}

function visibleNames() {
    return screen.getAllByRole('row').slice(1).map(row => cellsFor(row)[1]);
}

test('shows the PMS ID rather than the local ID', async () => {
    render(<SearchableTenantList />);

    expect(await screen.findByRole('columnheader', { name: 'PMS ID' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Daisy Ridley/ });
    expect(cellsFor(row).slice(0, 3)).toEqual(['3', 'Daisy Ridley', 'C303']);
});

test('flags a tenant that has no PMS ID', async () => {
    render(<SearchableTenantList />);

    const row = await screen.findByRole('row', { name: /Charlie Chaplin/ });
    expect(cellsFor(row).slice(0, 3)).toEqual(['Not in PMS', 'Charlie Chaplin', 'C303']);
    expect(screen.getAllByText('Not in PMS')).toHaveLength(1);
});

test('shows every tenant and the total before searching', async () => {
    render(<SearchableTenantList />);

    expect(await screen.findByText('Showing 5 of 5 tenants')).toBeInTheDocument();
});

test('searches by name, ignoring case', async () => {
    await renderAndSearch('yuki AND');

    expect(visibleNames()).toEqual(['Yuki Anderson']);
    expect(screen.getByText('Showing 1 of 5 tenants')).toBeInTheDocument();
});

test('searches by unit', async () => {
    await renderAndSearch('c303');

    expect(visibleNames()).toEqual(['Charlie Chaplin', 'Daisy Ridley']);
});

test('searches by PMS ID', async () => {
    await renderAndSearch('62');

    expect(visibleNames()).toEqual(['Yuki Anderson']);
});

test('finds tenants that are not in the PMS', async () => {
    await renderAndSearch('not in pms');

    expect(visibleNames()).toEqual(['Charlie Chaplin']);
});

test('says so when nothing matches', async () => {
    await renderAndSearch('  zzz ');

    expect(screen.getByText('No tenants match "zzz".')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 5 tenants')).toBeInTheDocument();
});

test('shows each tenant\'s balance as owed, credit or settled', async () => {
    render(<SearchableTenantList />);

    await screen.findByText('Alice Wonderland');
    const balances = screen.getAllByRole('row').slice(1).map(row => cellsFor(row).slice(1, 4).filter((_, i) => i !== 1));
    expect(balances).toEqual([
        ['Alice Wonderland', 'Settled'],
        ['Charlie Chaplin', 'Settled'],
        ['Daisy Ridley', '$1,240.10'],
        ['Yuki Anderson', '$550.00 credit'],
        ['Bob The Builder', '$2,425.20'],
    ]);
});

test('summarizes the balances of all tenants', async () => {
    render(<SearchableTenantList />);

    await screen.findByText('Alice Wonderland');
    expect(screen.getByText(/Outstanding/)).toHaveTextContent(
        'Outstanding $3,665.30 · 2 owing · 1 in credit ($550.00) · 2 settled'
    );
});

test('the summary follows the search', async () => {
    await renderAndSearch('c303');

    expect(screen.getByText(/Outstanding/)).toHaveTextContent(
        'Outstanding $1,240.10 · 1 owing · 0 in credit ($0.00) · 1 settled'
    );
});
