public with sharing class CustomReportsService {
    String reportToGenerate;
    Object dataResult;
    String lastValueFromPagination = null;
    
    @TestVisible
    static Map<String, Custom_Report__mdt> customReportDefinitionMap;
    static final Integer SOQL_TRAVERSING_LIMIT = 5; //hard stop, maximun relationship field queried in soql is 5
    
    static{
        customReportDefinitionMap = new Map<String, Custom_Report__mdt>();
        for(Custom_Report__mdt customReport : [select DeveloperName, MasterLabel, SObject_Api_Name__c, Filter__c, Page_Size__c,Index_Field_Api_Name__c,Chunks_Enabled__c, (select Custom_Report__c, Report_Field_Label__c, Field_API_Name__c, Report_Field_Order__c from Custom_Report_Fields__r  where Hide_from_Report__c != true order by Report_Field_Order__c DESC) from Custom_Report__mdt where Enabled__c = true]){
            customReportDefinitionMap.put(customReport.DeveloperName, customReport);
        }
    }

    public CustomReportsService setReportToGenerate(String reportToGenerate){
        if(!customReportDefinitionMap.containsKey(reportToGenerate)){
            throw new CustomReportException('Invalid reportToGenerate');
        }
        this.reportToGenerate = reportToGenerate;
        return this;
    }
    public CustomReportsService setLastValueFromPagination(String lastValueFromPagination){
        this.lastValueFromPagination = lastValueFromPagination;
        return this;
    }
    
    public CustomReportsService fetchData(){
        if(String.isEmpty(reportToGenerate)){
            return this;
        }
        String query = 'select ' + 
            getFieldsToSelect() + 
            ' from ' + 
            customReportDefinitionMap.get(reportToGenerate).SObject_Api_Name__c + 
            getFilter() + 
            getOrder() +
            getLimit();
        dataResult = Database.query(query);
        return this;
    }

    public List<Custom_Report__mdt> fetchReports(){
        return this.fetchReportList();
    }

    List<Custom_Report__mdt> fetchReportList(){
        return customReportDefinitionMap.values();
    }

    String getFieldsToSelect(){
        List<String> finalFields = new List<String>();
        for(Custom_Report_Field__mdt reportFieldDefinition : customReportDefinitionMap.get(reportToGenerate).Custom_Report_Fields__r){
            finalFields.add(reportFieldDefinition.Field_API_Name__c);
        }
        return String.join(finalFields, ',');
    }

    String getFilter(){
        return (!String.isEmpty(customReportDefinitionMap.get(reportToGenerate).Filter__c) || customReportDefinitionMap.get(reportToGenerate).Chunks_Enabled__c == true  ? ' WHERE ' : '') + 
        (!String.isEmpty(customReportDefinitionMap.get(reportToGenerate).Filter__c) ? customReportDefinitionMap.get(reportToGenerate).Filter__c : '') +
        (customReportDefinitionMap.get(reportToGenerate).Chunks_Enabled__c == true ? (String.isEmpty(customReportDefinitionMap.get(reportToGenerate).Filter__c) ? '' : ' AND ') + getPaginationExpression() : '');
    }

    String getOrder(){
        return  ( customReportDefinitionMap.get(reportToGenerate).Chunks_Enabled__c == true ? ' ORDER BY '  + customReportDefinitionMap.get(reportToGenerate).Index_Field_Api_Name__c + ' ASC ' : '' );
    }

    String getPaginationExpression(){
        return customReportDefinitionMap.get(reportToGenerate).Index_Field_Api_Name__c + ' > \''+ lastValueFromPagination + '\'';
    }

    String getLimit(){
        return customReportDefinitionMap.get(reportToGenerate).Page_Size__c > 0 ? ' LIMIT ' + customReportDefinitionMap.get(reportToGenerate).Page_Size__c : '';
    }

    public List<Map<String, Object>> toListOfMap(){
        if(dataResult != null && dataResult instanceof List<SObject>){
            List<SObject> listToFormat = (List<SObject>) dataResult;
            List<Map<String, Object>> result = new List<Map<String, Object>>();
            SObjectType targetSObjectType = listToFormat.getSObjectType();
            for(SObject record : listToFormat){
                Map<String, Object> mappedRecord = mapRecordLabelsWithValues(record, targetSObjectType);
                if(mappedRecord != null) {
                    result.add(mappedRecord);
                }
            }
            return result;
        }
        return new List<Map<String, Object>>();
    }

    Map<String, Object> mapRecordLabelsWithValues(SObject record, SObjectType targetSObjectType){
        SObjectType sobjectTypeToUse = targetSObjectType == null ? record.getSobjectType() : targetSObjectType;
        Map<String, Object> result = new Map<String, Object>();
        List<Custom_Report_Field__mdt> fieldsToGetTheLabelsFor = customReportDefinitionMap.get(reportToGenerate).Custom_Report_Fields__r;
        Map<String, String> fieldsLabel = getFieldsLabel(sobjectTypeToUse, fieldsToGetTheLabelsFor, record);
        for(Custom_Report_Field__mdt reportFieldDefinition : fieldsToGetTheLabelsFor){
            Object fieldValue = getFieldValue(reportFieldDefinition.Field_Api_Name__c, record);
            String finalLabel = String.isEmpty(reportFieldDefinition.Report_Field_Label__c) ? fieldsLabel.get(reportFieldDefinition.Field_Api_Name__c) : reportFieldDefinition.Report_Field_Label__c;
            result.put(finalLabel, fieldValue);
        }
        return result;
    }

    public Object getFieldValue(String fieldApiName, SObject record){
        Object result = null;
        if(fieldApiName.contains('.')){
            String targetFieldApiName = getFieldApiNameFromRelationshipField(fieldApiName, null);
            SObject relationshipObject = getLastSObjectRecord(record, fieldApiName);
            result = relationshipObject?.get(targetFieldApiName);
        }else{
            result = record.get(fieldApiName);
        }

        return result;
    }

    String getFieldApiNameFromRelationshipField(String fieldApiName, List<String> splittedRelationshipAndFieldNames){
        List<String> splited = fieldApiName.split('\\.');
        if(splittedRelationshipAndFieldNames != null) splittedRelationshipAndFieldNames.addAll(splited);
        return splited[splited.size() - 1];
    }

    SObject getLastSObjectRecord(SObject record, String fieldApiName){
        SObject result = null;
        if(record == null) return result;
        List<String> splittedRelationshipAndFieldNames = new List<String>();
        String targetFieldApiName =  getFieldApiNameFromRelationshipField(fieldApiName, splittedRelationshipAndFieldNames);
        String targetObjectRelationshipName = splittedRelationshipAndFieldNames[0];
        
        for(Integer i = 0; i < splittedRelationshipAndFieldNames.size() - 1; i++){
            if(i > (SOQL_TRAVERSING_LIMIT - 1)) break;
            String relationShipName = splittedRelationshipAndFieldNames[i];
            result = result == null ? record.getSObject(relationshipName) : result.getSObject(relationShipName);
        }
        return result;
    }

    public Map<String, String> getFieldsLabel(SObjectType targetObject, List<Custom_Report_Field__mdt> targetReportFieldDefinitions, SObject record){
        Map<String, String> result = new Map<String, String>();
        DescribeSObjectResult targetObjectDescribe = targetObject.getDescribe(SObjectDescribeOptions.DEFERRED);
        Map<String, SObjectField> fieldsMap = targetObjectDescribe.fields.getMap();
        for(Custom_Report_Field__mdt reportFieldDefinition : targetReportFieldDefinitions){
            if(!String.isEmpty(reportFieldDefinition.Report_Field_Label__c)) continue;

            if(reportFieldDefinition.Field_Api_Name__c.contains('.')){ //its a relation traversing
                String fieldApiNameFromObjectRelation = getFieldApiNameFromRelationshipField(reportFieldDefinition.Field_Api_Name__c, null);
                SObject lastSObjectFromRelationship = getLastSObjectRecord(record, reportFieldDefinition.Field_Api_Name__c);
                String vname = lastSObjectFromRelationship.getSObjectType().getDescribe().getName();
                
                Map<String, SOBjectField> fieldsMapFromRelation = lastSObjectFromRelationship.getSObjectType().getDescribe(SObjectDescribeOptions.DEFERRED).fields.getMap();
                if(fieldsMapFromRelation.containsKey(fieldApiNameFromObjectRelation)){
                    DescribeFieldResult describeResultFieldFromObjectRelation= fieldsMapFromRelation.get(fieldApiNameFromObjectRelation).getDescribe();
                    result.put(reportFieldDefinition.Field_Api_Name__c, describeResultFieldFromObjectRelation.getLabel());
                }
            }else{
                DescribeFieldResult fieldDescribeResult = fieldsMap.get(reportFieldDefinition.Field_Api_Name__c)?.getDescribe();
                result.put(reportFieldDefinition.Field_Api_Name__c, fieldDescribeResult?.getLabel());
            }
        }
        return result;
    }

    /*static Map<String, Set<String>> objectWithFieldsMappingForReclamos = new Map<String, Set<string>>{
        'Case' => new Set<String>{
            'CaseNumber',//Numero SS, ok
            'Status', //Estado?, ok
            'SubEstado__c', //Subestado ok
            'CreatedDate', //fecha de solicitud?, ok
            'ClosedDate', //fecha de cierre? ok 
            'Categoria__c',//clasificacion ??
            'Type', //Tipo?
            'Sub_tipo__c', //Subtipo
            'Tipo_Identificacion__c',//tipo de documento? Account.Tipo_Identificacion__c
            'Numero_Identificacion__c',//numero de documento? Account.Numero_Identificacion__c
            'Account.Name', //Nombre del cliente
            'Description',//voz del cliente
            'Asset.Name', //numero de cuenta
            'Nombre_de_producto__c', //producto?
            'Asset.Estado_Plastico__c',//estado del producto?
            'Fecha_incidencia__c',//Fecha Ocurrencia
            'Canal__c',//canal origen?
            'Sucursal__c', //sucursal de ingreso?
            'Metodo_de_contacto__c',//Medio Respuesta                          <-------------------------por alguna razon el reporte no lo quiere mostrar
            'Owner.Name',//Propietario
            'OwnerId',//Id propietario
            'Voz_del_Ejecutivo__c', //Voz Ejecutivo
            'SubEstado__c', //Decisión del Caso                                <-------------------------ya lo agregamos
            'Resultado_Evaluacion__c.Observaciones_Privadas__c',//Observaciones Finales	voz ejecutivo
            'Monto__c', //Monto reclamo
            'Monto_Devolver__c'//Monto Devuelto Final
        }
    };*/

    public class CustomReportException extends Exception {}
}