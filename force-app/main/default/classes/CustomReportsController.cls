public with sharing class CustomReportsController {
   @AuraEnabled
   public static String generateReportData(String reportToGenerate, String lastValueFromPagination){
    if(String.isEmpty(reportToGenerate)) return null;

   try {
        List<Map<String, Object>> result = new CustomReportsService()
            .setReportToGenerate(reportToGenerate)
            .setLastValueFromPagination(lastValueFromPagination)
            .fetchData()
            .toListOfMap();
        return JSON.serialize(result);
    } catch (Exception e) {
        throw new AuraHandledException(e.getMessage());
    }
   }

   @AuraEnabled
public static List<Map<String, String>> getActiveReportOptionList() {
    List<Map<String, String>> reportOptions = new List<Map<String, String>>();
    try {
        List<Custom_Report__mdt> reports = new CustomReportsService().fetchReports();
        for (Custom_Report__mdt r : reports) {
            Map<String, String> reportOption = new Map<String, String>();
            reportOption.put('label', r.MasterLabel);
            reportOption.put('value', r.DeveloperName);
            reportOptions.add(reportOption);
        }
    } catch (Exception e) {
        throw new AuraHandledException('Failed to fetch active reports: ' + e.getMessage());
    }
    return reportOptions;
}

@AuraEnabled
public static Map<String, Object> getActiveReportConfig(){
    Map<String, Object> reportConfigList = new Map<String,Object>();
    try {
        CustomReportsService service = new CustomReportsService();
        List<Custom_Report__mdt> reports = service.fetchReports();
        for (Custom_Report__mdt r : reports) {
            Map<String, Object> reportConfig = new Map<String, Object>();
            SObjectType targetSObjectType = ((SObject) Type.forName(r.SObject_Api_Name__c).newInstance()).getSObjectType();
            List<Custom_Report_Field__mdt> fieldsToGetTheLabelsFor = r.Custom_Report_Fields__r;
            Map<String, String> fieldsLabel = service.getFieldsLabel(targetSObjectType, fieldsToGetTheLabelsFor, null);
            reportConfig.put('IndexFieldLabel', fieldsLabel.get(r.Index_Field_Api_Name__c));
            reportConfig.put('ChunksEnabled', r.Chunks_Enabled__c);
            reportConfigList.put(r.DeveloperName, reportConfig);
        }
    } catch (Exception e) {
        throw new AuraHandledException('Failed to fetch active reports config: ' + e.getMessage());
    }
    return reportConfigList;
}

}