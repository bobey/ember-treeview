// Usage example
App = Ember.Application.create();

App.SimpleTreeExample = Ember.Namespace.create();
App.SimpleTreeExample.TreeNodeView = Ember.Tree.TreeNode.extend({
    templateName: 'tree-node'
});

App.SimpleTreeExample.TreeController = Ember.Tree.TreeController.extend({
    
    // Tree Configuration
    treeNodeViewClass: 'App.SimpleTreeExample.TreeNodeView',
    displayRootElement: false,
    
    treeContent: function() {

        var content = [],
            root = Ember.Tree.Node.create({
                label: 'Root',
                children: []
            });

        content.pushObject(root);

        for (var i = 0; i < 5 ; i++) {
            var node = Ember.Tree.Node.create({
                label: 'Tree Folder ' + i,
                children: []
            });

            root.get('children').pushObject(node);
            node.set('parent', root);
            content.pushObject(node);

            // Simulate asynchronous operations to retrieve childrens
            setTimeout(function(content, node, count) {
                for (var i = 0; i < 5 ; i++) {
                    var label = 'Tree Node ' + count + '_' + i,
                        subNode = Ember.Tree.Node.create({
                            label: label,
                            children: []
                        });

                    node.get('children').pushObject(subNode);
                    subNode.set('parent', node);
                    content.pushObject(subNode);
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

