import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCosts } from "@/hooks/useCosts";
import { CostCategory, CostType } from "@/types/finance";
import { cn } from "@/lib/utils";
import { DollarSign, Trash2, Pencil, Calendar, Plus } from "lucide-react";
import CostCategoryFormDialog from "@/components/CostCategoryFormDialog";
import React from "react";
import DeleteConfirmationDialog from "@/components/DeleteConfirmationDialog";
import { showSuccess } from "@/utils/toast";
import { Switch } from "@/components/ui/switch";
import CostTag from "@/components/CostTag"; // Importando o novo componente
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

// Componente para a Faixa de Resumo (Total de Custos Ativos)
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
        className="text-3xl font-extrabold text-red-400"
      />
    </CardContent>
  </Card>
);

// Componente para a Linha de Categoria de Custo
interface CostCategoryItemProps {
  category: CostCategory;
  onDelete: (id: string) => void;
  onEdit: (updatedCategory: CostCategory) => void;
  onToggleActive: (id: string) => void;
}

const CostCategoryItem: React.FC<CostCategoryItemProps> = ({ 
  category, 
  onDelete, 
  onEdit, 
  onToggleActive 
}) => {
  const isFixo = category.type === "Fixo";
  
  // Formata apenas o dia/mês, conforme o anexo
  const formattedDueDate = category.dueDate
    ? new Date(category.dueDate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : "N/A";

  const handleDelete = () => {
    onDelete(category.id);
    showSuccess("Categoria de custo excluída com sucesso.");
  };

  const handleEditSubmit = (data: Omit<CostCategory, "id" | "isActive">, id?: string) => {
    if (id) {
      onEdit({ ...data, id, isActive: category.isActive });
      showSuccess("Categoria de custo atualizada com sucesso!");
    }
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-sidebar-border hover:bg-sidebar-accent/30 transition-colors group">
      
      {/* Bloco 1: Switch e Detalhes - Otimizado para não sobrepor */}
      <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0 w-full lg:w-[40%]">
        <Switch 
          checked={category.isActive}
          onCheckedChange={() => onToggleActive(category.id)}
          className="data-[state=checked]:bg-[#3b82f680] flex-shrink-0"
        />
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-semibold text-sidebar-primary-foreground truncate">
            {category.name}
          </span>
          <span className="text-xs text-gray-400 mt-0.5 md:mt-1 truncate">
            {category.description || (isFixo ? "Custo Fixo Recorrente" : "Custo Variável")}
          </span>
        </div>
      </div>
      
      {/* Bloco 2: Métricas (Tipo, Valor e Vencimento) - Otimizado para Tablet */}
      <div className="flex justify-between items-center flex-shrink-0 text-sm text-gray-400 w-full md:w-auto lg:w-[60%] mt-3 md:mt-0 md:px-4 space-x-4">
        
        {/* Coluna 1: Tipo */}
        <div className="flex justify-start md:w-20 lg:w-[33.33%]">
          <CostTag type={category.type} />
        </div>
        
        {/* Coluna 2: Valor */}
        <div className="flex justify-center md:w-24 lg:w-[33.33%]">
          {isFixo && category.value !== undefined && (
            <HiddenValue
                value={category.value}
                formatFn={formatCurrency}
                className="font-bold text-red-500 whitespace-nowrap"
            />
          )}
        </div>
        
        {/* Coluna 3: Vencimento - Removido texto longo para ganhar espaço no tablet */}
        <div className="flex justify-end items-center md:w-24 lg:w-[33.33%]">
          {isFixo && category.dueDate ? (
            <div className="flex items-center text-xs md:text-sm text-gray-400">
              <Calendar className="w-3.5 h-3.5 mr-1 flex-shrink-0" /> 
              <span className="whitespace-nowrap">
                {/* No tablet/desktop, mostra apenas a data para economizar espaço */}
                {formattedDueDate}
                {/* Texto 'Vencimento' apenas em telas muito grandes */}
                <span className="hidden xl:inline ml-1"> (Venc.)</span>
              </span>
            </div>
          ) : (
            <div className="w-3.5 md:w-24 lg:w-full"></div>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex space-x-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ml-auto md:ml-4 flex-shrink-0 mt-3 md:mt-0">
        <CostCategoryFormDialog
          initialData={category}
          onSubmit={handleEditSubmit}
          trigger={
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-sidebar-foreground hover:bg-accent"
              title="Editar Categoria"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          }
        />
        
        <DeleteConfirmationDialog
          title="Confirmar Exclusão"
          description={`Tem certeza que deseja excluir a categoria "${category.name}"? Isso não afetará transações passadas, mas removerá a opção de cadastro futura.`}
          onConfirm={handleDelete}
          trigger={
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-red-500 hover:bg-red-900/20"
              title="Excluir Categoria"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          }
        />
      </div>
    </div>
  );
};

const FolhaDePagamento = () => {
  const { 
    costCategories, 
    addCostCategory, 
    updateCostCategory, 
    deleteCostCategory, 
    toggleCostCategoryActive,
    summary 
  } = useCosts();

  const handleAddCategory = (data: Omit<CostCategory, "id" | "isActive">) => {
    addCostCategory(data);
    showSuccess("Categoria de custo cadastrada com sucesso!");
  };
  
  // Modal Trigger para o FAB
  const fabTrigger = (
    <FloatingActionButton
        icon={<Plus className="w-6 h-6" />}
        onClick={() => { /* Abre o modal */ }}
        colorClass="bg-red-600 hover:bg-red-700"
    />
  );

  return (
    <Layout 
        pageTitle="Gestão de Custos" 
        pageSubtitle="Cadastre e gerencie categorias de custos fixos e variáveis."
    >
      <div className="space-y-6">
        {/* Header e Botão Nova Categoria - Visível apenas em telas maiores (lg:flex) */}
        <div className="hidden lg:flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-sidebar-primary-foreground">
              Gestão de Custos
            </h1>
            <p className="text-gray-400 mt-1">
              Cadastre e gerencie categorias de custos fixos e variáveis.
            </p>
          </div>
          <div className="flex space-x-3 items-center">
            <VisibilityToggleButton /> {/* Adicionado o botão de visibilidade */}
            <CostCategoryFormDialog 
              onSubmit={handleAddCategory} 
              trigger={
                <Button className="bg-red-600 hover:bg-red-700 text-white">
                  + Nova Categoria
                </Button>
              }
            />
          </div>
        </div>
        
        {/* Botão Nova Categoria - Oculto no mobile/tablet */}
        <div className="flex lg:hidden justify-end hidden">
            {/* Conteúdo oculto, o FAB será o trigger */}
        </div>

        {/* Faixa Total de Custos Fixos Ativos */}
        <SummaryStrip
          title="Total de Custos Fixos Ativos (Mensal)"
          value={summary.totalActiveFixedCosts}
        />

        {/* Lista de Categorias */}
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <CardHeader className="p-4">
            <CardTitle className="text-xl font-bold">
                Categorias Cadastradas
            </CardTitle>
            <Separator className="my-4 bg-sidebar-border" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {costCategories.length > 0 ? (
                costCategories.map((c) => (
                  <CostCategoryItem 
                    key={c.id} 
                    category={c} 
                    onDelete={deleteCostCategory} 
                    onEdit={updateCostCategory}
                    onToggleActive={toggleCostCategoryActive}
                  />
                ))
              ) : (
                <p className="text-center text-gray-500 p-8">
                  Nenhuma categoria de custo cadastrada ainda.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* FAB para Nova Categoria (Mobile Only) */}
      <CostCategoryFormDialog 
        onSubmit={handleAddCategory} 
        trigger={fabTrigger}
      />
    </Layout>
  );
};

export default FolhaDePagamento;