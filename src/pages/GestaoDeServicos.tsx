import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useServices } from "@/hooks/useServices";
import { Briefcase, Tag } from "lucide-react";
import React from "react";
import ServiceCategoryManagementContent from "@/components/ServiceCategoryManagementContent";

const GestaoDeServicos = () => {
  const { serviceCategories } = useServices();
  
  return (
    <Layout 
        pageTitle="Gestão de Soluções" 
        pageSubtitle="Cadastre e gerencie as soluções de serviços oferecidas."
    >
      <div className="space-y-6">
        <div className="hidden lg:flex flex-col">
          <h1 className="text-3xl font-bold text-sidebar-primary-foreground">
            Gestão de Soluções
          </h1>
          <p className="text-gray-400 mt-1">
            Cadastre e gerencie as soluções que aparecem no lançamento de vendas.
          </p>
        </div>

        <Card className="bg-card border-border shadow-xl">
          <CardContent className="flex justify-between items-center p-4">
            <span className="text-lg font-semibold text-foreground">
              Total de Soluções Cadastradas
            </span>
            <span className="text-3xl font-extrabold text-blue-400">
              {serviceCategories.length}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <CardHeader className="p-4">
            <CardTitle className="text-xl font-bold flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-blue-500" />
                Soluções Cadastradas
            </CardTitle>
            <Separator className="my-4 bg-sidebar-border" />
          </CardHeader>
          <CardContent className="p-4">
            <ServiceCategoryManagementContent />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default GestaoDeServicos;