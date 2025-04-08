({
    handleInputChange: function (cmp, evt, hlp) {
        var inputName = evt.getSource().get('v.name');
        cmp.set('v.' + inputName, evt.getSource().get('v.value') || evt.getSource().get('v.checked'));
    },

    handleGenerateTestOrderClick: function (cmp, evt, hlp) {
        cmp.set('v.isLoading', true);
        var action = cmp.get('c.generateTestOrder');
        action.setCallback(this, function (response) {
            var state = response.getState();
            console.log(state, response.getReturnValue());
            if (state === 'SUCCESS') {
                cmp.set('v.salesOrderId', response.getReturnValue());
            } else if (state === 'ERROR') {
                var errors = response.getError();
                if (errors) {
                    if (errors[0] && errors[0].message) {
                        // log the error passed in to AuraHandledException
                        console.log('Error message: ' +
                            errors[0].message);
                    }
                } else {
                    console.log('Unknown error');
                }
            }
            cmp.set('v.isLoading', false);
        });
        $A.enqueueAction(action);
    },

    handleCheckout: function (cmp, evt, hlp) {
        cmp.set('v.isLoading', true);
        hlp.readyToPayPromise(cmp)
            .then($A.getCallback(function (readyToPayResponse) {
                console.log('readyToPayResponse', JSON.parse(JSON.stringify(readyToPayResponse)));
                var paymentMethodId = null;
                var selectedPaymentMethod = cmp.get('v.selectedPaymentMethod');
                var saveCard = cmp.get('v.saveCard');

                if (selectedPaymentMethod && selectedPaymentMethod.length) {
                    paymentMethodId = selectedPaymentMethod;
                    hlp.payPromise(cmp, paymentMethodId);
                } else if (saveCard) {
                    hlp.savePaymentMethodPromise(cmp)
                        .then($A.getCallback(function (savePaymentMethodResponse) {
                            console.log('savePaymentMethodResponse', JSON.parse(JSON.stringify(savePaymentMethodResponse)));
                            if (savePaymentMethodResponse && savePaymentMethodResponse
                                .PaymentMethodId) {
                                paymentMethodId = savePaymentMethodResponse.PaymentMethodId;
                                hlp.getPaymentMethodOptions(cmp);
                            }
                            hlp.payPromise(cmp, paymentMethodId);
                        }));
                } else {
                    hlp.payPromise(cmp, paymentMethodId);
                }
            }));
    },


    handleAuth: function (cmp, evt, hlp) {
        var payload = JSON.parse(JSON.stringify(evt.getParam('payload')))
        console.log('handleAuth', payload);
        cmp.set('v.salesOrderId', '');
        if (payload.data.IsSuccess) {
            alert('Payment Successful!');
        } else if (!payload.data.IsSuccess && payload.data.Message) {
            alert('Payment Failed: ' + payload.data.Message);
        }
    },

    connectedCallback: function (component, event, helper) {
        helper.getPaymentMethodOptions(component);
    }
})