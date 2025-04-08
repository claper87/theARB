({
    executeCheckoutAction: function (cmp, actionName, params) {
        return new Promise($A.getCallback(function (resolve, reject) {
            var action = cmp.get('c.executeCheckoutAction');
            action.setParams({
                'action': actionName,
                'args': params
            });
            action.setCallback(this, function (response) {
                var state = response.getState();
                if (state === 'SUCCESS') {
                    resolve(response.getReturnValue());
                } else if (state === 'ERROR') {
                    reject(response.getError());
                }
            });
            $A.enqueueAction(action);
        })).catch($A.getCallback((error) => {
            return {
                'IsSuccess': false,
                'Status': 'failed',
                'Message': Array.isArray(error) ? error[0].message : error.message
            };
        }));
    },

    payPromise: function (cmp, paymentMethodId) {
        var hlp = this;
        return hlp.executeCheckoutAction(cmp, 'PAY', {
            'SalesOrderId': cmp.get('v.salesOrderId'),
            'CreditCard': hlp.getCreditCardObject(cmp, paymentMethodId)
        }).then($A.getCallback((response) => {
            cmp.set('v.authorizationUrl', response.AuthorizationUrl);
            cmp.set('v.isLoading', false);
            console.log('payResponse', response);
            if (response.IsSuccess) {
                alert('Payment Successful!');
            } else if (!response.IsSuccess && response.Message) {
                alert('Payment Failed: ' + response.Message);
            }
            return response;
        }));
    },

    readyToPayPromise: function (cmp) {
        var hlp = this;
        return hlp.executeCheckoutAction(cmp, 'READY_TO_PAY', {
            'SalesOrderId': cmp.get('v.salesOrderId')
        });
    },

    savePaymentMethodPromise: function (cmp) {
        var hlp = this;

        return hlp.executeCheckoutAction(cmp, 'SAVE_PAYMENT_METHOD', {
            'SalesOrderId': cmp.get('v.salesOrderId'),
            'CreditCard': hlp.getCreditCardObject(cmp)
        }).then($A.getCallback((response) => {
            if (response.IsSuccess) {
                alert('Save Payment Method!');
            } else if (!response.IsSuccess) {
                alert('Failed to Save Payment Method');
            }
            return response;
        }));
    },

    getCreditCardObject: function (cmp, paymentMethodId) {
        var cardNumber = cmp.get('v.cardNumber');
        var expMonth = cmp.get('v.expMonth');
        var expYear = cmp.get('v.expYear');
        var cvv = cmp.get('v.cvv');
        var postalCode = cmp.get('v.postalCode');
        var country = cmp.get('v.country');

        if (paymentMethodId && paymentMethodId.length) {
            return {
                'PaymentMethodId': paymentMethodId
            };
        }

        return {
            'CardNumber': cardNumber,
            'Exp': {
                'Month': expMonth,
                'Year': expYear < 100 ? 2000 + parseInt(expYear) : parseInt(expYear)
            },
            'CVV': cvv,
            'PostalCode': postalCode,
            'Country': country
        };
    },

    getPaymentMethodOptions: function (cmp) {
        var hlp = this;
        var action = cmp.get('c.getSavedPaymentMethodOptions');
        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === 'SUCCESS') {
                cmp.set('v.savedPaymentMethodsOptions', response.getReturnValue());
            } else if (state === "ERROR") {
                var errors = response.getError();
                if (errors) {
                    if (errors[0] && errors[0].message) {
                        // log the error passed in to AuraHandledException
                        console.log("Error message: " + errors[0].message);
                    }
                } else {
                    console.log("Unknown error");
                }
            }
            hlp.disableLoading(cmp);
        });
        $A.enqueueAction(action);
    },

    enableLoading: function (cmp) {
        cmp.set('v.isLoading', true);
    },

    disableLoading: function (cmp) {
        cmp.set('v.isLoading', false);
    }
})