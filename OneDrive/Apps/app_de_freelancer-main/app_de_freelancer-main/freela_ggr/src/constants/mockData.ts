
export type Role = 'cliente' | 'profissional';
export type BudgetStatus = 'solicitado' | 'pendente' | 'realizado' | 'recusado';

export type Service = { 
    id: string; 
    title: string; 
    category: string; 
    provider: string; 
    price: string; 
    rating: string; 
    description: string; 
    trending?: boolean; 
    recent?: boolean 
};

export type Budget = { 
    id: string; 
    client: string; 
    service: string; 
    value: string; 
    date: string; 
    status: BudgetStatus 
};

// Dados falsos para alimentar o catálogo
export const servicesMock: Service[] = [
    { id: '1', title: 'Pintura residencial', category: 'Pintura', provider: 'Casa Nova Serviços', price: 'R$ 180', rating: '4,9', description: 'Paredes, tetos e acabamento para ambientes residenciais.', trending: true, recent: true },
    { id: '2', title: 'Instalação elétrica', category: 'Elétrica', provider: 'Voltagem Pro', price: 'R$ 120', rating: '4,8', description: 'Instalações, reparos e revisão elétrica com segurança.', trending: true },
    { id: '3', title: 'Limpeza pós-obra', category: 'Limpeza', provider: 'Brilho Total', price: 'R$ 220', rating: '4,7', description: 'Limpeza detalhada para entregar seu espaço pronto.', recent: true },
    { id: '4', title: 'Reparo hidráulico', category: 'Hidráulica', provider: 'Fluxo Assistência', price: 'R$ 95', rating: '4,9', description: 'Vazamentos, torneiras, registros e tubulações.', trending: true, recent: true },
    { id: '5', title: 'Móveis planejados', category: 'Marcenaria', provider: 'Oficina Linha', price: 'R$ 650', rating: '4,8', description: 'Projeto e montagem de móveis sob medida.', recent: true },
    { id: '6', title: 'Manutenção de ar-condicionado', category: 'Refrigeração', provider: 'Clima Certo', price: 'R$ 150', rating: '4,6', description: 'Higienização e manutenção preventiva.', trending: true },
];

// Dados falsos para alimentar o painel do profissional
export const initialBudgetsMock: Budget[] = [
    { id: '1', client: 'Marina Alves', service: 'Pintura residencial', value: 'R$ 980', date: 'Hoje', status: 'solicitado' },
    { id: '2', client: 'Rafael Costa', service: 'Instalação elétrica', value: 'R$ 320', date: 'Ontem', status: 'pendente' },
    { id: '3', client: 'Bianca Souza', service: 'Limpeza pós-obra', value: 'R$ 540', date: '12 jun', status: 'realizado' },
    { id: '4', client: 'Eduardo Lima', service: 'Reparo hidráulico', value: 'R$ 210', date: '10 jun', status: 'recusado' },
];