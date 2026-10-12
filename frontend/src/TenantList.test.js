import { render, screen, within } from '@testing-library/react';
import TenantList from './TenantList';

const tenants = [
    { id: 3, name: 'Charlie Chaplin', unit: 'C303', pms_tenant_id: null },
    { id: 4, name: 'Daisy Ridley', unit: 'C303', pms_tenant_id: 3 },
];

beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tenants) }));
});

function cellsFor(row) {
    return within(row).getAllByRole('cell').map(cell => cell.textContent);
}

test('shows the PMS ID rather than the local ID', async () => {
    render(<TenantList onViewLedger={() => {}} />);

    expect(await screen.findByRole('columnheader', { name: 'PMS ID' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Daisy Ridley/ });
    expect(cellsFor(row).slice(0, 3)).toEqual(['3', 'Daisy Ridley', 'C303']);
});

test('flags a tenant that has no PMS ID', async () => {
    render(<TenantList onViewLedger={() => {}} />);

    const row = await screen.findByRole('row', { name: /Charlie Chaplin/ });
    expect(cellsFor(row).slice(0, 3)).toEqual(['Not in PMS', 'Charlie Chaplin', 'C303']);
    expect(screen.getAllByText('Not in PMS')).toHaveLength(1);
});
