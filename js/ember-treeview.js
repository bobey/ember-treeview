(function() {

    // Ember Tree
    Ember.Tree = Ember.Namespace.create();

    // Ember Tree Node
    Ember.Tree.Node = Ember.Object.extend({
        label: null,
        isActive: false,
        isSelected: false,
        isOpened: false,
        parent: null,
        children: [],

        level: function() {
            return this._computeLevel(this.get('parent'), 0);
        }.property().volatile(),

        isRoot: function() {
            return this.get('parent') === null;
        }.property('parent'),

        isBranch: function() {
            return this.get('children').length > 0;
        }.property('children', 'children.@each'),

        isLeaf: function() {
            return !this.get('children').length;
        }.property('children', 'children.@each'),

        _computeLevel: function(node, level) {
            if (null !== node) {
                return this._computeLevel(node.get('parent'), level+1);
            }

            return level;
        }
    });

    // Mixins
    /**
     * Ember.StyleBindingsMixin
     * CREDITS for this one to Addepar EmberTable
     */
    Ember.StyleBindingsMixin = Ember.Mixin.create({
        concatenatedProperties: ['styleBindings'],
        attributeBindings: ['style'],
        unitType: 'px',
        createStyleString: function(styleName, property) {
            var value;
            value = this.get(property);
            if (value === void 0) {
                return;
            }
            if (Ember.typeOf(value) === 'number') {
                value = value + this.get('unitType');
            }
            return "" + styleName + ":" + value + ";";
        },
        applyStyleBindings: function() {
            var lookup, properties, styleBindings, styleComputed, styles,
                _this = this;
            styleBindings = this.styleBindings;
            if (!styleBindings) {
                return;
            }
            lookup = {};
            styleBindings.forEach(function(binding) {
                var property, style, _ref;
                _ref = binding.split(':'), property = _ref[0], style = _ref[1];
                return lookup[style || property] = property;
            });
            styles = Ember.keys(lookup);
            properties = styles.map(function(style) {
                return lookup[style];
            });
            styleComputed = Ember.computed(function() {
                var styleString, styleTokens;
                styleTokens = styles.map(function(style) {
                    return _this.createStyleString(style, lookup[style]);
                });
                styleString = styleTokens.join('');
                if (styleString.length !== 0) {
                    return styleString;
                }
            });
            styleComputed.property.apply(styleComputed, properties);
            return Ember.defineProperty(this, 'style', styleComputed);
        },
        init: function() {
            this.applyStyleBindings();
            return this._super();
        }
    });


    // Utils
    function _removeParent(node) {
        // Node doesn't belongs to its old parent anymore
        if (node.get('parent')) {
            node.get('parent.children').removeObject(node);
        }
    };

    function _insertNodeInto(nodeDropped, targetNode) {
        _removeParent(nodeDropped);

        targetNode.get('children').pushObject(nodeDropped);
        nodeDropped.set('parent', targetNode);

        targetNode.set('isOpened', true);
    };

    function _insertNodeAfter(nodeDropped, afterNode) {
        _removeParent(nodeDropped);

        // Which is the position of the target node?
        var parentTarget = afterNode.get('parent');
        if (parentTarget) {
            var index = parentTarget.get('children').indexOf(afterNode);
            nodeDropped.set('parent', parentTarget);
            parentTarget.get('children').insertAt(index+1, nodeDropped);
        }
    };

    function _getNodeFromDOM($element) {
        return Ember.View.views[$element.attr('id')].get('node');
    };

    // Controllers
    Ember.Tree.TreeController = Ember.Controller.extend({

        // Configuration
        dragAndDrop: true,
        treeNodeViewClass: 'Ember.Tree.TreeNodeContainer',
        displayRootElement: false,

        content: function() {}.property(),

        treeContent: function() {
            return this.get('content');
        }.property(),

        treeContentDidChanged: function() {
            this.get('content').forEach(function(node) {
                this._observeNode(node);
            }, this);
        }.observes('content', 'content.@each'),

        _notifyTreeContentDidChanged: function() {
            this.notifyPropertyChange('treeContent');
        },

        _observeNode: function(node) {
            node.addObserver('children', this, '_notifyTreeContentDidChanged');
            node.addObserver('children.@each', this, '_notifyTreeContentDidChanged');
            node.addObserver('parent', this, '_notifyTreeContentDidChanged');
            node.addObserver('isOpened', this, '_notifyTreeContentDidChanged');
        },

        _isDescendantOf: function(descendant, parent) {
            if (this.get('displayRootElement') && null === descendant.get('parent') || ! this.get('displayRootElement') && descendant.get('parent.isRoot')) {
                return false;
            }

            return descendant.get('parent') === parent ? true : this._isDescendantOf(descendant.get('parent'), parent);
        },

        isDropAllowed: function(overingNode, targetNode) {
            return !this._isDescendantOf(targetNode, overingNode);
        }
    });

    // Views
    Ember.Tree.TreeContainer = Ember.CollectionView.extend({

        controller: null,
        itemViewClass: Ember.computed.alias('controller.treeNodeViewClass'),
        displayRootElement: Ember.computed.alias('controller.displayRootElement'),
        classNames: ['tree-container'],

        content: function() {
            var tree = [];

            var root = this.get('nodes').findProperty('isRoot', true);

            if (this.get('displayRootElement')) {
                tree.pushObject(root);
            }

            this._flattenTree(tree, root);

            return tree;
        }.property('nodes'),

        _flattenTree: function(tree, node) {

            if (!this.get('displayRootElement') && node.get('isRoot') || node.get('isBranch') && node.get('isOpened')) {

                node.get('children').forEach(function(childNode) {
                    tree.pushObject(childNode);
                    this._flattenTree(tree, childNode);
                }, this);
            }
        },

        nodes: Ember.computed.alias('controller.treeContent')
    });

    Ember.Tree.TreeNodeContainer = Ember.View.extend(Ember.StyleBindingsMixin, {
        templateName: 'tree-node-container',
        classNames: ['tree-node-container'],
        displayRootElement: Ember.computed.alias('controller.displayRootElement'),

        styleBindings:  ['indentation:padding-left'],

        indentation: function() {
            return (this.get('node.level') - (this.get('displayRootElement') ? 0 : 1) ) * 20 + 'px';
        }.property('node.level'),

        nodes: Ember.computed.alias('controller.content'),
        node: Ember.computed.alias('content'),

        // Events
        mouseEnter: function() {
            this.get('node').set('isActive', true);
        },
        mouseLeave: function() {
            this.get('node').set('isActive', false);
        },

        doubleClick: function() {
            this.get('node').toggleProperty('isOpened');
        },

        click: function(event) {
            var node = this.get('node'),
                nodes = this.get('nodes');

            if (!event.ctrlKey) {
                var currentNode = node;
                nodes.forEach(function(node) {
                    if (node !== currentNode) {
                        node.set('isSelected', false);
                    }
                });
            }

            node.toggleProperty('isSelected');
        },

        treeNodeView: Ember.View.extend({
            templateName: 'tree-node',
            classNames: ['tree-node'],
            classNameBindings: ['node.isActive', 'node.isSelected', 'node.isBranch', 'node.isOpened:is-opened:is-closed'],

            node: Ember.computed.alias('parentView.node'),

            nodeContent: function() {
                return this.get('node.label');
            }.property('node'),

            didInsertElement: function() {
                this._super(arguments);
                this.$().draggable({
                    helper: function() {
                        return Ember.$('<span/>').append(Ember.$('.node-content', this).html());
                    }
                });

                this.$().droppable({
                    tolerance: 'pointer',
                    drop: Ember.$.proxy(this.onNodeDropped, this),
                    over: Ember.$.proxy(this.onNodeOver, this),
                    out: Ember.$.proxy(this.onNodeOut, this)
                });
            },

            //_timer: null,

            onNodeDropped: function(event, ui) {
                this.$().removeClass('drag-over drag-forbidden');

                var targetNode = this.get('node'),
                    overingNode = _getNodeFromDOM(ui.draggable),
                    controller = this.get('controller');

                Ember.run.scheduleOnce('afterRender', this, function() {
                    if (controller.isDropAllowed(overingNode, targetNode)) {
                        _insertNodeInto(overingNode, targetNode);
                    }
                });
            },

            onNodeOver: function(event, ui) {
                this.$().addClass('drag-over');
                var targetNode = this.get('node'),
                    overingNode = _getNodeFromDOM(ui.draggable),
                    controller = this.get('controller');

                controller.send('nodeOverNode', overingNode, targetNode);

                if (!controller.isDropAllowed(overingNode, targetNode)) {
                    this.$().addClass('drag-forbidden');
                }

                /*if (!node.get('isLead') && !node.get('isOpened')) {
                 this.set('_timer', setTimeout(function(node) {
                 node.set('isOpened', true);
                 }, 500, node));
                 }*/
            },

            onNodeOut: function() {
                this.$().removeClass('drag-over drag-forbidden');

                /*var timer = this.get('_timer');
                 if (timer) {
                 clearTimeout(timer);
                 }*/
            },

            treeNodeHeader: Ember.View.extend({
                node: Ember.computed.alias('parentView.node'),
                classNames: ['tree-node-header'],
                click: function(event) {
                    event.stopPropagation();
                    this.get('node').toggleProperty('isOpened');
                }
            })
        }),

        treeNodeAfterView: Ember.View.extend({
            classNames: ['drop-after-node'],
            node: Ember.computed.alias('parentView.node'),
            didInsertElement: function() {
                this._super(arguments);
                this.$().droppable({
                    tolerance: 'pointer',
                    drop: Ember.$.proxy(this.onNodeDropped, this),
                    over: Ember.$.proxy(this.onNodeOver, this),
                    out: Ember.$.proxy(this.onNodeOut, this)
                });
            },

            onNodeDropped: function(event, ui) {
                event.stopPropagation();
                this.$().removeClass('drag-over drag-forbidden');

                var controller = this.get('controller'),
                    overingNode = _getNodeFromDOM(ui.draggable),
                    targetNode = this.get('node');

                Ember.run.scheduleOnce('afterRender', this, function() {
                    if (controller.isDropAllowed(overingNode, targetNode)) {
                        _insertNodeAfter(overingNode, targetNode);
                    }
                });
            },

            onNodeOver: function(event, ui) {
                this.$().addClass('drag-over');

                var controller = this.get('controller'),
                    overingNode = _getNodeFromDOM(ui.draggable),
                    targetNode = this.get('node');

                controller.send('nodeAfterNode', overingNode, targetNode);

                if (!controller.isDropAllowed(overingNode, targetNode)) {
                    this.$().addClass('drag-forbidden');
                }
            },

            onNodeOut: function() {
                this.$().removeClass('drag-over drag-forbidden');
            }
        })
    });
})();

