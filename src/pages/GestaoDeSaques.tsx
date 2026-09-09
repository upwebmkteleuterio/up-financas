import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { usePartners } from "@/hooks/usePartners";
import { Partner } from "@/types/finance";
import { cn } from "@/lib/utils";
import { DollarSign, Trash2, Pencil, Phone, User, Plus } from "lucide-react";
import PartnerFormDialog from "@/components/PartnerFormDialog";
import React from "react";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import { showSuccess } from "@/utils/toast";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import HiddenValue from "@/components/HiddenValue"; // Importando HiddenValue
import FloatingActionButton from "@/components/FloatingActionButton"; // Importando FAB
import { VisibilityToggleButton } from "@/hooks/useFinancialVisibility"; // Importando o botão de toggle

// Função utilitária para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Componente para a Faixa de Resumo (Total de Saques Ativos)
interface SummaryStripProps {
  title: string;
  value: number;
}

const SummaryStrip: React.FC<SummaryStripProps> = ({ title, value }) => (
  <Card className="bg-card border-border shadow-xl">
    <CardContent className="flex justify-between items-center p-4">
      <span className="text-lg font-semibold text-foreground">
        {title}
      </span>
      <HiddenValue
        value={value}
        formatFn={formatCurrency}
        className="text-3xl font-extrabold text-purple-400"
      />
    </CardContent>
  </Card>
);

// Componente para a Linha de Sócio
interface PartnerItemProps {
  partner: Partner & { totalSaquesCurrentMonth: number };
  onDelete: (id: string) => void;
  onEdit: (updatedPartner: Partner) => void;
  onToggleActive: (id: string) => void;
}

const PartnerItem: React.FC<PartnerItemProps> = ({ 
  partner, 
  onDelete, 
  onEdit, 
  onToggleActive 
}) => {
  
  const handleDelete = () => {
    onDelete(partner.id);
    showSuccess("Sócio excluído com sucesso.");
  };

  const handleEditSubmit = (data: Omit<Partner, "id" | "isActive">, id?: string) => {
    if (id) {
      onEdit({ ...data, id, isActive: partner.isActive });
      showSuccess("Sócio atualizado com sucesso!");
    }
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-sidebar-border hover:bg-sidebar-accent/30 transition-colors group">
      
      {/* Bloco 1: Detalhes do Sócio - 40% no desktop, flex-1 no tablet */}
      <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0 w-full lg:w-[40%]">
        <Switch 
          checked={partner.isActive}
          onCheckedChange={() => onToggleActive(partner.id)}
          className="data-[state=checked]:bg-[#3b82f680] flex-shrink-0"
        />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-semibold text-sidebar-primary-foreground truncate">
            {partner.name}
          </span>
          <span className={cn("text-xs mt-0.5 md:mt-1 truncate", partner.isActive ? "text-gray-400" : "text-red-500")}>
            {partner.isActive ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>
      
      {/* Bloco 2: Telefone e Valor - Otimizado para Tablet (md) */}
      <div className="flex justify-between items-center flex-shrink-0 text-sm text-gray-400 w-full md:w-auto lg:w-[60%] mt-3 md:mt-0 md:px-4 space-x-4">
        
        {/* Coluna 1: Telefone */}
        <div className="flex justify-start items-center md:w-32 lg:w-1/2">
          <Phone className="w-3.5 h-3.5 mr-1.5 hidden lg:block flex-shrink-0" />
          <span className="whitespace-nowrap">{partner.phone}</span>
        </div>
        
        {/* Coluna 2: Total de Saques */}
        <div className="flex flex-col items-end md:w-32 lg:w-1/2">
          <HiddenValue
            value={partner.totalSaquesCurrentMonth}
            formatFn={formatCurrency}
            className="font-bold text-purple-500 whitespace-nowrap text-lg"
          />
          <span className="text-[10px] md:text-xs text-gray-500 whitespace-nowrap">Saques (Mês atual)</span>
        </div>
      </div>

      {/* Bloco 3: Ações */}
      <div className="flex space-x-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ml-auto md:ml-4 flex-shrink-0 mt-3 md:mt-0">
        <PartnerFormDialog
          initialData={partner}
          onSubmit={handleEditSubmit}
          trigger={
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-sidebar-foreground hover:bg-accent"
              title="Editar Sócio"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          }
        />
        
        <DeleteConfirmationDialog
          title="Confirmar Exclusão"
          description={`Tem certeza que deseja excluir o sócio "${partner.name}"? Isso não afetará transações passadas, mas removerá a opção de saque futura.`}
          onConfirm={handleDelete}
          trigger={
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-red-500 hover:bg-red-900/20"
              title="Excluir Sócio"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          }
        />
      </div>
    </div>
  );
};

const GestaoDeSaques = () => {
  const { 
    partners, 
    addPartner, 
    updatePartner, 
    deletePartner, 
    togglePartnerActive,
    summary 
  } = usePartners();

  const handleAddPartner = (data: Omit<Partner, "id" | "isActive">) => {
    addPartner(data, {
        onSuccess: () => {
            showSuccess("Sócio cadastrado com sucesso!");
        }
    });
  };
  
  // Modal Trigger para o FAB
  const fabTrigger = (
    <FloatingActionButton
        icon={<Plus className="w-6 h-6" />}
        onClick={() => { /* Abre o modal */ }}
        colorClass="bg-purple-600 hover:bg-purple-700"
    />
  );

  return (
    <Layout 
        pageTitle="Gestão de Saques" 
        pageSubtitle="Cadastre e gerencie os sócios que podem receber saques de lucro."
    >
      <div className="space-y-6">
        {/* Header e Botão Novo Sócio - Visível apenas em telas maiores (lg:flex) */}
        <div className="hidden lg:flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-sidebar-primary-foreground">
              Gestão de Saques de Lucro
            </h1>
            <p className="text-gray-400 mt-1">
              Cadastre e gerencie os sócios que podem receber saques de lucro.
            </p>
          </div>
          <div className="flex space-x-3 items-center">
            <VisibilityToggleButton /> {/* Adicionado o botão de visibilidade */}
            <PartnerFormDialog 
              onSubmit={handleAddPartner} 
              trigger={
                <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                  <User className="w-4 h-4 mr-2" />
                  + Novo Sócio
                </Button>
              }
            />
          </div>
        </div>
        
        {/* Faixa Total de Saques no Mês Corrente */}
        <SummaryStrip
          title={`Total de Saques de Lucro (Mês atual)`}
          value={summary.totalSaquesCurrentMonth}
        />

        {/* Lista de Sócios */}
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <CardHeader className="p-4">
            <CardTitle className="text-xl font-bold">
                Sócios Cadastrados
            </CardTitle>
            <Separator className="my-4 bg-sidebar-border" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {summary.saquesByPartner.length > 0 ? (
                summary.saquesByPartner.map((p) => (
                  <PartnerItem 
                    key={p.id} 
                    partner={p} 
                    onDelete={deletePartner} 
                    onEdit={updatePartner}
                    onToggleActive={togglePartnerActive}
                  />
                ))
              ) : (
                <p className="text-center text-gray-500 p-8">
                  Nenhum sócio cadastrado ainda.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* FAB para Novo Sócio (Mobile Only) */}
      <PartnerFormDialog 
        onSubmit={handleAddPartner} 
        trigger={fabTrigger}
      />
    </Layout>
  );
};

export default GestaoDeSaques;