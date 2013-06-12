// Usage example
App = Ember.Application.create();

App.SimpleTreeExample = Ember.Namespace.create();
App.SimpleTreeExample.TreeController = Ember.Tree.TreeController.extend({
    displayRootElement: true,
    content: function() {

        var content = [],
            root = Ember.Tree.Node.create({
                label: 'Root',
                children: []
            });

        content.pushObject(root);

        for (var i = 0; i < 5 ; i++) {
            var node = Ember.Tree.Node.create({
                label: 'Node_' + i,
                children: []
            });

            root.get('children').pushObject(node);
            node.set('parent', root);
            content.pushObject(node);

            // Simulate asynchronous operations to retrieve childrens
            setTimeout(function(content, node, count) {
                for (var i = 0; i < 5 ; i++) {
                    var label = 'Node_' + count + '_' + i,
                        subNode = Ember.Tree.Node.create({
                            label: label,
                            children: []
                        });

                    node.get('children').pushObject(subNode);
                    subNode.set('parent', node);
                    content.pushObject(subNode);

                    setTimeout(function(content, node, count1, count2) {
                        for (var i = 0; i < 5 ; i++) {
                            var label = 'Node_' + count1 + '_' + count1 + '_' + i,
                                subNode = Ember.Tree.Node.create({
                                    label: label,
                                    children: []
                                });

                            node.get('children').pushObject(subNode);
                            subNode.set('parent', node);
                            content.pushObject(subNode);
                        }
                    }, 500, content, subNode, count, i);
                }
            }, 500, content, node, i);
        }

        return content;

    }.property()
});

App.ApplicationView = Ember.View.extend({
    classNames: 'ember-app',
    templateName: 'application'
});

App.ApplicationController = Ember.Controller.extend({
    treeController: function() {
        return Ember.get('App.SimpleTreeExample.TreeController').create();
    }.property()
});

