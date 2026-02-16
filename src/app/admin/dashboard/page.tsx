'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Users,
    DollarSign,
    TrendingUp,
    Settings,
    LogOut,
    Eye,
    Edit,
    Trash2,
    Download,
    Plus,
    Lock,
    Hash,
    X,
    Save,
    Check,
    Phone,
    MapPin,
    Search,
    Globe,
    Trophy,
    Sparkles
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'sales' | 'customers' | 'settings' | 'draw'>('dashboard');
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await fetch('/api/admin/logout', { method: 'POST' });
            router.push('/admin');
            router.refresh();
        } catch (e) {
            console.error(e);
            router.push('/admin');
        }
    };

    return (
        <div className="min-h-screen textured-bg grid-pattern">
            {/* Header Content Wrapper */}
            <div className="bg-black/40 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
                <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '18px 24px' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Image src="/logo.png" alt="Logo" width={50} height={50} />
                            <div>
                                <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
                                <p className="text-white/60 text-sm">Y Voss Oeee - Dinámica 1</p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Salir
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '18px 24px', paddingBottom: '96px' }}>
                {/* Navigation Tabs */}
                <div className="flex flex-wrap gap-4 mb-8 border-b border-white/10 pb-4">
                    <TabButton
                        active={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                        icon={<BarChart3 className="w-5 h-5" />}
                        label="Dashboard"
                    />
                    <TabButton
                        active={activeTab === 'sales'}
                        onClick={() => setActiveTab('sales')}
                        icon={<DollarSign className="w-5 h-5" />}
                        label="Ventas"
                    />
                    <TabButton
                        active={activeTab === 'customers'}
                        onClick={() => setActiveTab('customers')}
                        icon={<Users className="w-5 h-5" />}
                        label="Clientes"
                    />
                    <TabButton
                        active={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                        icon={<Settings className="w-5 h-5" />}
                        label="Configuración"
                    />
                    <TabButton
                        active={activeTab === 'draw'}
                        onClick={() => setActiveTab('draw')}
                        icon={<Trophy className="w-5 h-5 text-yellow-400" />}
                        label="Sorteo"
                    />
                </div>

                {/* Content */}
                <div className="min-h-[600px]">
                    {activeTab === 'dashboard' && <DashboardView />}
                    {activeTab === 'sales' && <SalesView />}
                    {activeTab === 'customers' && <CustomersView />}
                    {activeTab === 'settings' && <SettingsView />}
                    {activeTab === 'draw' && <DrawView />}
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${active
                ? 'bg-white text-black shadow-lg shadow-white/10'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

function DashboardView() {
    const [analytics, setAnalytics] = useState({ pageviews: 0, unique: 0 });
    const [sales, setSales] = useState<any[]>([]);

    useEffect(() => {
        // Fetch analytics
        fetch('/api/analytics/summary')
            .then(res => res.json())
            .then(data => data.today && setAnalytics(data.today))
            .catch(err => console.error(err));

        // Fetch sales data
        fetch('/api/sales')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setSales(data);
                } else {
                    console.error('Expected sales array but got:', data);
                    setSales([]);
                }
            })
            .catch(err => {
                console.error('Error fetching sales:', err);
                setSales([]);
            });
    }, []);

    // Derived Stats
    const totalVendido = sales.reduce((acc, curr) => acc + curr.total, 0);
    const totalTickets = sales.reduce((acc, curr) => acc + (curr.tickets ? curr.tickets.length : 0), 0);
    const uniqueBuyers = new Set(sales.map(s => s.customerId)).size;

    // Recent Tickets (Top 20 Flat list)
    const allTickets = sales.flatMap(s => s.tickets || []);
    const recentTickets = allTickets.slice(0, 20); // Last 20 sold

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
                <StatsCard
                    title="Visitas Hoy"
                    value={(analytics.unique ?? 0).toLocaleString()}
                    icon={<Eye className="w-6 h-6 text-white" />}
                    gradient="bg-pink-600"
                    trend="Únicos"
                />
                <StatsCard
                    title="Total Vendido"
                    value={`$${(totalVendido ?? 0)}`}
                    icon={<DollarSign className="w-6 h-6 text-white" />}
                    gradient="bg-emerald-600"
                />
                <StatsCard
                    title="Tickets Vendidos"
                    value={(totalTickets ?? 0).toString()}
                    icon={<TrendingUp className="w-6 h-6 text-white" />}
                    gradient="bg-blue-600"
                />
                <StatsCard
                    title="Compradores"
                    value={(uniqueBuyers ?? 0).toString()}
                    icon={<Users className="w-6 h-6 text-white" />}
                    gradient="bg-purple-600"
                />
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-[18px]">
                {/* Recent Sales */}
                <div className="glass-strong p-6 rounded-2xl flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white">Ventas Recientes</h3>
                        <button className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">Ver todas</button>
                    </div>
                    <div className="space-y-1 flex-1 overflow-y-auto pr-2 max-h-[400px]">
                        {sales.slice(0, 10).map((sale, i) => (
                            <div key={i} className="grid grid-cols-12 gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors items-center">
                                <div className="col-span-4">
                                    <div className="text-white font-medium">#{sale.id}</div>
                                    <div className="text-white/40 text-xs">{new Date(sale.date).toLocaleTimeString()}</div>
                                </div>
                                <div className="col-span-5">
                                    <div className="text-white/80 text-sm truncate">{sale.customer?.fullName || sale.client}</div>
                                </div>
                                <div className="col-span-3 text-right">
                                    <div className="text-white font-bold">${sale.total}</div>
                                </div>
                            </div>
                        ))}
                        {sales.length === 0 && <p className="text-white/50 text-center py-4">No hay ventas recientes</p>}
                    </div>
                </div>

                {/* Latest Tickets Sold (Replacement for Most Sold) */}
                <div className="glass-strong p-6 rounded-2xl flex flex-col h-full">
                    <h3 className="text-xl font-bold text-white mb-6">Últimos Tickets Vendidos</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto pr-2">
                        {recentTickets.map((ticket: string, i: number) => (
                            <div key={i} className="p-2 bg-white/10 rounded-lg text-center border border-white/10">
                                <span className="font-mono font-bold text-white text-sm">{ticket}</span>
                            </div>
                        ))}
                        {recentTickets.length === 0 && <p className="col-span-full text-white/50 text-center py-4">No hay tickets vendidos</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SalesView() {
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            loadSales(searchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const loadSales = (query?: string) => {
        setLoading(true);
        const url = query ? `/api/sales?q=${encodeURIComponent(query)}` : '/api/sales';
        fetch(url)
            .then(res => res.json())
            .then(data => {
                setSales(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error loading sales:', err);
                setLoading(false);
            });
    };

    const handleOpenDetail = (sale: any) => {
        setSelectedSale(sale);
        // Ensure editForm has deep copy of customer object to avoid reference issues
        setEditForm(JSON.parse(JSON.stringify(sale)));
        setIsEditing(false);
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!editForm.customer?.firstName && !editForm.customer?.fullName) {
            // Fallback for legacy
            if (!editForm.client) return alert('Datos incompletos');
        }

        const updatedRequest = {
            ...editForm,
            customer: editForm.customer ? {
                ...editForm.customer,
                fullName: (editForm.customer.firstName && editForm.customer.lastName)
                    ? `${editForm.customer.lastName} ${editForm.customer.firstName}`.trim()
                    : editForm.customer.fullName
            } : undefined
        };

        try {
            const res = await fetch(`/api/sales/${selectedSale.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRequest)
            });

            if (res.ok) {
                const updated = await res.json();
                setSelectedSale(updated);
                setIsEditing(false);
                loadSales();
                alert('Venta actualizada correctamente');
            } else {
                alert('Error al actualizar venta');
            }
        } catch (error) {
            console.error(error);
            alert('Error al guardar');
        }
    };

    const isNumericSearch = /^\d+$/.test(searchTerm);
    const showNumericHint = isNumericSearch && searchTerm.length >= 4;

    const exportCSV = () => {
        const url = new Blob().toString(); // dummy
        const exportUrl = `/api/sales/export?q=${encodeURIComponent(searchTerm)}`;

        // Trigger download via hidden link or window location
        const link = document.createElement("a");
        link.href = exportUrl;
        link.setAttribute("download", `ventas_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper for display
    const getCustomerName = (s: any) => s.customer?.fullName || s.client || '-';
    const getCustomerEmail = (s: any) => s.customer?.email || s.email || '-';
    const getCustomerField = (s: any, field: string) => s.customer?.[field] || s[field] || '-';

    return (
        <div className="space-y-6 w-full relative">
            <div className="flex flex-col md:flex-row justify-between gap-4 items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Gestión de Ventas</h2>
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="searchWrap flex-1 md:flex-initial">
                        <span className="searchIcon">🔍</span>
                        <input
                            className="searchInput"
                            type="text"
                            placeholder="Buscar por cédula, nombres o #ticket…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {showNumericHint && (
                            <div className="absolute -bottom-6 left-0 text-[10px] text-purple-400 animate-pulse font-medium">
                                Buscando por ticket o cédula...
                            </div>
                        )}
                    </div>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:scale-105 transition-transform text-sm"
                    >
                        <Download className="w-4 h-4" />
                        CSV
                    </button>
                </div>
            </div>

            <div className="glass-strong rounded-2xl border border-white/10 flex flex-col p-6">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[1000px]">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4 text-left text-white/60 text-xs uppercase tracking-wider font-semibold min-w-[80px]">ID</th>
                                <th className="px-6 py-4 text-left text-white/60 text-xs uppercase tracking-wider font-semibold min-w-[200px]">Cliente</th>
                                <th className="px-6 py-4 text-left text-white/60 text-xs uppercase tracking-wider font-semibold min-w-[70px]">Cant.</th>
                                <th className="px-6 py-4 text-left text-white/60 text-xs uppercase tracking-wider font-semibold min-w-[240px]">Tickets</th>
                                <th className="px-6 py-4 text-left text-white/60 text-xs uppercase tracking-wider font-semibold min-w-[90px]">Total</th>
                                <th className="px-6 py-4 text-left text-white/60 text-xs uppercase tracking-wider font-semibold min-w-[180px]">Fecha</th>
                                <th className="px-6 py-4 text-right text-white/60 text-xs uppercase tracking-wider font-semibold min-w-[110px]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => handleOpenDetail(sale)}>
                                    <td className="px-6 py-4 whitespace-nowrap text-white font-mono">#{sale.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                                {getCustomerName(sale).charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-white font-medium text-sm truncate">{getCustomerName(sale)}</div>
                                                <div className="text-white/40 text-xs truncate">{getCustomerEmail(sale)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-white font-bold">{sale.tickets.length}</td>
                                    <td className="px-6 py-4 text-white text-sm">
                                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                                            {sale.tickets.slice(0, 3).map((t: string) => (
                                                <span key={t} className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono border border-white/10">{t}</span>
                                            ))}
                                            {sale.tickets.length > 3 && (
                                                <span className="text-xs text-white/40 flex items-center">+{sale.tickets.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-green-400 font-bold">${sale.total}</td>
                                    <td className="px-6 py-4 text-white/60 text-sm">{new Date(sale.date).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Ver detalle">
                                            <Eye className="w-4 h-4 text-white" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {loading && (
                        <div className="py-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                            <p className="mt-4 text-white/40 text-sm">Buscando ventas...</p>
                        </div>
                    )}

                    {!loading && sales.length === 0 && (
                        <div className="py-20 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                                <Search className="w-8 h-8 text-white/20" />
                            </div>
                            <h3 className="text-white font-bold text-lg">Sin resultados</h3>
                            <p className="text-white/40 text-sm">No encontramos ventas que coincidan con "{searchTerm}"</p>
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="mt-4 text-purple-400 hover:text-purple-300 text-sm font-medium"
                                >
                                    Limpiar búsqueda
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {selectedSale && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                    >
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    Venta #{selectedSale.id}
                                    <span className="text-sm font-normal text-white/50 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                                        {new Date(selectedSale.date).toLocaleString()}
                                    </span>
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isEditing ? (
                                    <button
                                        onClick={handleEdit}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors text-sm font-medium"
                                    >
                                        <Edit className="w-4 h-4" /> Editar Datos
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                    >
                                        <Save className="w-4 h-4" /> Guardar
                                    </button>
                                )}
                                <button onClick={() => setSelectedSale(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <h4 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                                        <Users className="w-5 h-5 text-purple-500" />
                                        Información del Cliente
                                    </h4>

                                    <div className="grid gap-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-white/50 uppercase font-semibold">Apellidos</label>
                                                {isEditing ? (
                                                    <input
                                                        value={editForm.customer?.lastName || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, customer: { ...editForm.customer, lastName: e.target.value.toUpperCase() } })}
                                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                                                    />
                                                ) : (
                                                    <div className="text-white">{getCustomerField(selectedSale, 'lastName')}</div>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-white/50 uppercase font-semibold">Nombres</label>
                                                {isEditing ? (
                                                    <input
                                                        value={editForm.customer?.firstName || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, customer: { ...editForm.customer, firstName: e.target.value.toUpperCase() } })}
                                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                                                    />
                                                ) : (
                                                    <div className="text-white">{getCustomerField(selectedSale, 'firstName')}</div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs text-white/50 uppercase font-semibold">Nombre Completo</label>
                                            <div className="text-white text-lg">{selectedSale.customer?.fullName || selectedSale.client || '-'}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-white/50 uppercase font-semibold">Cédula / ID</label>
                                                {isEditing ? (
                                                    <input
                                                        value={editForm.customer?.idNumber || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, customer: { ...editForm.customer, idNumber: e.target.value } })}
                                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                                                        maxLength={10}
                                                    />
                                                ) : (
                                                    <div className="text-white flex items-center gap-2"><Hash className="w-3 h-3 text-white/40" /> {getCustomerField(selectedSale, 'idNumber')}</div>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-white/50 uppercase font-semibold">Teléfono</label>
                                                {isEditing ? (
                                                    <input
                                                        value={editForm.customer?.phone || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, customer: { ...editForm.customer, phone: e.target.value } })}
                                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                                                        maxLength={10}
                                                    />
                                                ) : (
                                                    <div className="text-white flex items-center gap-2"><Phone className="w-3 h-3 text-white/40" /> {getCustomerField(selectedSale, 'phone')}</div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs text-white/50 uppercase font-semibold">Email</label>
                                            {isEditing ? (
                                                <input
                                                    value={editForm.customer?.email || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, customer: { ...editForm.customer, email: e.target.value } })}
                                                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                                                />
                                            ) : (
                                                <div className="text-white break-all">{getCustomerField(selectedSale, 'email')}</div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-white/50 uppercase font-semibold">Provincia</label>
                                                {isEditing ? (
                                                    <input
                                                        value={editForm.customer?.province || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, customer: { ...editForm.customer, province: e.target.value } })}
                                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                                                    />
                                                ) : (
                                                    <div className="text-white flex items-center gap-2"><MapPin className="w-3 h-3 text-white/40" /> {getCustomerField(selectedSale, 'province')}</div>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-white/50 uppercase font-semibold">Ciudad</label>
                                                {isEditing ? (
                                                    <input
                                                        value={editForm.customer?.city || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, customer: { ...editForm.customer, city: e.target.value } })}
                                                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                                                    />
                                                ) : (
                                                    <div className="text-white">{getCustomerField(selectedSale, 'city')}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                                        <TrendingUp className="w-5 h-5 text-green-500" />
                                        Tickets Comprados ({selectedSale.tickets.length})
                                    </h4>

                                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                        <div className="flex justify-between items-end mb-4">
                                            <div className="text-white/60 text-sm">Total Pagado</div>
                                            <div className="text-3xl font-bold text-green-400">${selectedSale.total}</div>
                                        </div>

                                        <div className="h-[1px] bg-white/10 my-4"></div>

                                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                            {selectedSale.tickets.map((t: string) => (
                                                <div key={t} className="bg-black/40 border border-white/20 text-white font-mono text-center py-2 rounded font-bold hover:bg-white/10 transition-colors text-sm">
                                                    {t}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3">
                                        <p className="text-blue-200 text-xs flex gap-2">
                                            <span className="min-w-4 pt-0.5"><Lock className="w-4 h-4" /></span>
                                            <span>Los tickets no pueden ser editados para garantizar la integridad del sorteo. Si necesita cambiar tickets, cancele esta venta y genere una nueva.</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )
            }
        </div >
    );
}

function SettingsView() {
    const [settings, setSettings] = useState<any>({
        raffleTitle: '',
        prizes: [],
        contactEmail: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                setSettings(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                alert('Configuración guardada exitosamente');
            } else {
                alert('Error al guardar');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
        setSaving(false);
    };

    const updatePrize = (index: number, field: 'title' | 'amount', value: string) => {
        const newPrizes = [...settings.prizes];
        newPrizes[index] = { ...newPrizes[index], [field]: value };
        setSettings({ ...settings, prizes: newPrizes });
    };

    if (loading) return <div className="text-white">Cargando configuración...</div>;

    return (
        <div className="space-y-6 max-w-3xl">
            <h2 className="text-2xl font-bold text-white">Configuración del Sistema</h2>

            <div className="glass-strong p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Configuración de Rifa</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-white/80 mb-2 font-medium">Título de la Dinámica</label>
                        <input
                            type="text"
                            value={settings.raffleTitle}
                            onChange={(e) => setSettings({ ...settings, raffleTitle: e.target.value })}
                            className="w-full input-field"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-white/80 mb-2 font-medium">Número Mínimo</label>
                            <input
                                type="text"
                                value="0001"
                                disabled
                                className="w-full input-field opacity-50 cursor-not-allowed bg-black/20"
                            />
                        </div>
                        <div>
                            <label className="block text-white/80 mb-2 font-medium">Número Máximo</label>
                            <input
                                type="text"
                                value="9999"
                                disabled
                                className="w-full input-field opacity-50 cursor-not-allowed bg-black/20"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-strong p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Premios</h3>
                <div className="space-y-4">
                    {settings.prizes && settings.prizes.map((prize: any, index: number) => (
                        <div key={index} className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-1 text-white font-bold text-lg bg-white/10 w-8 h-8 flex items-center justify-center rounded-full">
                                {index + 1}
                            </div>
                            <div className="col-span-7">
                                <label className="block text-xs text-white/60 mb-1">Título del Premio</label>
                                <input
                                    type="text"
                                    value={prize.title}
                                    onChange={(e) => updatePrize(index, 'title', e.target.value)}
                                    className="w-full input-field text-sm"
                                />
                            </div>
                            <div className="col-span-4">
                                <label className="block text-xs text-white/60 mb-1">Valor/Monto</label>
                                <input
                                    type="text"
                                    value={prize.amount}
                                    onChange={(e) => updatePrize(index, 'amount', e.target.value)}
                                    className="w-full input-field text-sm font-mono"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass-strong p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Contacto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-white/80 mb-2 font-medium">Email de Contacto</label>
                        <input
                            type="email"
                            value={settings.contactEmail || ''}
                            onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                            className="w-full input-field"
                        />
                    </div>
                    <div>
                        <label className="block text-white/80 mb-2 font-medium">Teléfono (Opcional)</label>
                        <input
                            type="text"
                            value={settings.contactPhone || ''}
                            onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                            className="w-full input-field"
                            placeholder="+593 99 999 9999"
                        />
                    </div>
                    <div>
                        <label className="block text-white/80 mb-2 font-medium">WhatsApp (Opcional)</label>
                        <input
                            type="text"
                            value={settings.contactWhatsapp || ''}
                            onChange={(e) => setSettings({ ...settings, contactWhatsapp: e.target.value })}
                            className="w-full input-field"
                            placeholder="Link o número"
                        />
                    </div>
                    <div>
                        <label className="block text-white/80 mb-2 font-medium">Texto Corto (Opcional)</label>
                        <input
                            type="text"
                            value={settings.contactText || ''}
                            onChange={(e) => setSettings({ ...settings, contactText: e.target.value })}
                            className="w-full input-field"
                            placeholder="Escríbenos para más info..."
                        />
                    </div>
                </div>
            </div>

            <div className="glass-strong p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Textos Legales</h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-white/80 mb-2 font-medium">Términos y Condiciones</label>
                        <textarea
                            value={settings.termsHtml || ''}
                            onChange={(e) => setSettings({ ...settings, termsHtml: e.target.value })}
                            className="w-full input-field min-h-[150px] font-mono text-sm"
                            placeholder="HTML o Texto plano..."
                        />
                        <p className="text-white/40 text-xs mt-1">Se recomienda usar etiquetas HTML básicas como &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;.</p>
                    </div>
                    <div>
                        <label className="block text-white/80 mb-2 font-medium">Política de Privacidad</label>
                        <textarea
                            value={settings.privacyHtml || ''}
                            onChange={(e) => setSettings({ ...settings, privacyHtml: e.target.value })}
                            className="w-full input-field min-h-[150px] font-mono text-sm"
                            placeholder="HTML o Texto plano..."
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:shadow-lg hover:shadow-white/20 transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>
        </div >
    );
}

function DrawView() {
    const [loading, setLoading] = useState(false);
    const [winner, setWinner] = useState<any>(null);
    const [error, setError] = useState('');
    const [confirmDraw, setConfirmDraw] = useState(false);

    const handleDraw = async () => {
        setLoading(true);
        setError('');
        setWinner(null);

        try {
            // Add a small delay for suspense
            await new Promise(resolve => setTimeout(resolve, 2000));

            const res = await fetch('/api/draw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (res.ok) {
                setWinner(data);
                // Trigger confetti or sound here if possible
            } else {
                setError(data.error || 'Error al realizar el sorteo');
            }
        } catch (err) {
            setError('Error de conexión intente nuevamente');
            console.error(err);
        } finally {
            setLoading(false);
            setConfirmDraw(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
                    <Sparkles className="text-yellow-400 w-8 h-8" />
                    Sorteo Aleatorio
                    <Sparkles className="text-yellow-400 w-8 h-8" />
                </h2>
                <p className="text-white/60 text-lg">Selecciona un ganador al azar entre todos los tickets pagados.</p>
            </div>

            {!winner && !loading && (
                <div className="flex flex-col items-center justify-center py-12">
                    {!confirmDraw ? (
                        <button
                            onClick={() => setConfirmDraw(true)}
                            className="group relative px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-2xl font-bold text-white text-xl shadow-lg shadow-yellow-500/20 hover:scale-105 transition-all"
                        >
                            <span className="flex items-center gap-2">
                                <Trophy className="w-6 h-6" />
                                Realizar Sorteo
                            </span>
                        </button>
                    ) : (
                        <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl max-w-md text-center">
                            <h3 className="text-white font-bold text-lg mb-2">¿Estás seguro?</h3>
                            <p className="text-white/70 mb-6 text-sm">Esta acción seleccionará un ganador de forma aleatoria. Asegúrate de que todos los participantes estén registrados.</p>
                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={() => setConfirmDraw(false)}
                                    className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDraw}
                                    className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors font-bold"
                                >
                                    Sí, Sortear
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {loading && (
                <div className="py-20 text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-white/10 border-t-yellow-400 mb-6"></div>
                    <h3 className="text-2xl font-bold text-white animate-pulse">Mezclando tickets...</h3>
                    <p className="text-white/40 mt-2">Buena suerte a todos</p>
                </div>
            )}

            {winner && (
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative"
                >
                    <div className="absolute -inset-4 bg-gradient-to-r from-yellow-500/20 to-purple-500/20 blur-3xl rounded-full"></div>

                    <div className="relative glass-strong border border-yellow-500/30 p-8 rounded-3xl shadow-2xl overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                            <Trophy className="w-24 h-24 text-yellow-400/20 rotate-12" />
                        </div>

                        <div className="text-center mb-8">
                            <span className="inline-block px-4 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-bold border border-yellow-500/30 mb-4">
                                ¡TENEMOS UN GANADOR!
                            </span>
                            <h3 className="text-5xl font-black text-white tracking-tight mb-2">
                                {winner.customer.fullName}
                            </h3>
                            <p className="text-white/50 text-xl">{winner.customer.city}</p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 mt-8">
                            <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Ticket Ganador</p>
                                <p className="text-4xl font-mono font-bold text-yellow-400 tracking-wider">
                                    #{winner.ticket.number}
                                </p>
                                <p className="text-white/40 text-xs mt-2">
                                    Venta #{winner.sale.id} • {new Date(winner.sale.date).toLocaleDateString()}
                                </p>
                            </div>

                            <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Datos de Contacto</p>
                                <div className="space-y-2">
                                    <p className="text-white flex items-center gap-2">
                                        <Hash className="w-4 h-4 text-white/40" /> {winner.customer.idNumber}
                                    </p>
                                    <p className="text-white flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-white/40" /> {winner.customer.phone}
                                    </p>
                                    <p className="text-white flex items-center gap-2 truncate">
                                        <Globe className="w-4 h-4 text-white/40" /> {winner.customer.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={() => setWinner(null)}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-sm font-medium"
                            >
                                Realizar otro sorteo
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-center">
                    {error}
                </div>
            )}
        </div>
    );
}

function CustomersView() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/customers').then(res => res.json()),
            fetch('/api/sales').then(res => res.json())
        ]).then(([custData, salesData]) => {
            setCustomers(Array.isArray(custData) ? custData : []);
            setSales(Array.isArray(salesData) ? salesData : []);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    const getCustomerSales = (customerId: string) => {
        return sales.filter(s => s.customerId === customerId);
    };

    const filteredCustomers = customers.filter(c => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return true;

        // 1. Basic match (Name, ID, Email)
        const basicMatch = (c.fullName || "").toLowerCase().includes(term) ||
            (c.idNumber || "").includes(term) ||
            (c.email || "").toLowerCase().includes(term);

        if (basicMatch) return true;

        // 2. Ticket match
        if (/^\d+$/.test(term)) {
            const customerSales = getCustomerSales(c.id);
            const paddedQ = term.padStart(4, '0');
            const paddedQ6 = term.padStart(6, '0');
            return customerSales.some(s =>
                s.tickets.some((t: string) => t === term || t === paddedQ || t === paddedQ6)
            );
        }

        return false;
    });

    if (loading) return <div className="text-white py-10 text-center">Cargando base de clientes...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-600 rounded-xl shadow-lg shadow-purple-500/20">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Clientes Unicos</h2>
                </div>
                <div className="searchWrap md:w-96">
                    <span className="searchIcon">🔍</span>
                    <input
                        className="searchInput"
                        type="text"
                        placeholder="Buscar por nombre, cédula o #ticket..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCustomers.map(customer => {
                    const stats = customer.stats || { ventas: 0, tickets: 0, total: 0 };

                    return (
                        <motion.div
                            key={customer.id}
                            whileHover={{ y: -5 }}
                            onClick={() => setSelectedCustomer({ ...customer, sales: getCustomerSales(customer.id) })}
                            className="glass-strong p-6 rounded-2xl border border-white/10 cursor-pointer hover:bg-white/5 transition-all group"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-bold text-white shadow-lg">
                                    {(customer.fullName || "C").charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-white font-bold truncate group-hover:text-purple-400 transition-colors">{customer.fullName || "Sin nombre"}</h3>
                                    <p className="text-white/40 text-xs truncate">{customer.email || "Sin email"}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                                <div>
                                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">Ventas</p>
                                    <p className="text-white font-bold">{stats.ventas}</p>
                                </div>
                                <div>
                                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">Tickets</p>
                                    <p className="text-white font-bold text-pink-400">{stats.tickets}</p>
                                </div>
                                <div>
                                    <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-1">Total</p>
                                    <p className="text-green-400 font-bold">${stats.total}</p>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
                {filteredCustomers.length === 0 && (
                    <div className="col-span-full py-20 text-center text-white/30">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No se encontraron clientes que coincidan con la búsqueda</p>
                    </div>
                )}
            </div>

            {/* Modal Historial Cliente */}
            {selectedCustomer && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0A0A0A] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                    >
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-bold text-white shadow-lg">
                                    {(selectedCustomer.fullName || "C").charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{selectedCustomer.fullName}</h3>
                                    <p className="text-white/50 text-sm flex items-center gap-2 italic">
                                        <Hash className="w-3 h-3" /> {selectedCustomer.idNumber || "Sin cédula"}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white">
                                <X className="w-6 h-5" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar">
                            <div className="grid lg:grid-cols-3 gap-8 mb-8">
                                <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Contacto</p>
                                    <div className="space-y-2">
                                        <p className="text-white text-sm flex items-center gap-2"><Phone className="w-3 h-3 text-purple-400" /> {selectedCustomer.phone || "N/A"}</p>
                                        <p className="text-white text-sm break-all flex items-center gap-2"><Globe className="w-3 h-3 text-purple-400" /> {selectedCustomer.email || "N/A"}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Ubicación</p>
                                    <div className="space-y-2">
                                        <p className="text-white text-sm capitalize flex items-center gap-2">
                                            <MapPin className="w-3 h-3 text-pink-400" />
                                            {selectedCustomer.city || "Sin ciudad"}
                                        </p>
                                        <p className="text-white/40 text-xs italic ml-5">{selectedCustomer.country}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Resumen Financiero</p>
                                    <div className="space-y-1">
                                        <p className="text-green-400 font-bold text-3xl tracking-tighter">${selectedCustomer.sales.reduce((acc: any, s: any) => acc + s.total, 0)}</p>
                                        <p className="text-white/60 text-xs">{selectedCustomer.sales.reduce((acc: any, s: any) => acc + s.tickets.length, 0)} Tickets comprados totales</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-purple-500" />
                                    Historial de Compras
                                </h4>
                                <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-white/60">
                                    {selectedCustomer.sales.length} transacciones
                                </span>
                            </div>

                            <div className="space-y-4">
                                {selectedCustomer.sales.map((sale: any) => (
                                    <div key={sale.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col md:flex-row justify-between gap-4 hover:border-white/20 transition-colors">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="bg-white/10 text-white font-mono font-bold px-2 py-1 rounded text-sm tracking-tight">#{sale.id}</span>
                                                <span className="text-white/30 text-xs">{new Date(sale.date).toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {sale.tickets.map((t: string) => (
                                                    <span key={t} className="bg-black/40 border border-white/10 px-2 py-0.5 rounded text-[10px] font-mono text-white/60 hover:text-white transition-colors cursor-default">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col justify-center min-w-[120px]">
                                            <div className="text-2xl font-bold text-white tracking-tight">${sale.total}</div>
                                            <div className="text-white/40 text-xs font-medium uppercase tracking-widest">{sale.tickets.length} tickets</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

function StatsCard({ title, value, icon, gradient, trend }: any) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="glass-strong p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[140px] border border-white/10"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${gradient} bg-opacity-80 text-white shadow-lg`}>
                    {icon}
                </div>
                {trend && (
                    <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-lg">
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-green-400"></div>
                        <span className="text-green-400 text-xs font-bold">{trend}</span>
                    </div>
                )}
            </div>
            <div>
                <div className="text-white/60 text-sm font-medium mb-1">{title}</div>
                <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
            </div>
        </motion.div>
    );
}
