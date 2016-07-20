var data = [
    {
        id: 1,
        time: "now",
        ip: "127.0.0.1",
        port: "12345",
        processes: [
            {
                id: 2,
                exe: "/bin/bash",
                children: [
                    {
                        id: 3,
                        exe: "/bin/vim",
                        children: []
                    },
                    {
                        id: 4,
                        exe: "/bin/cp",
                        children: []
                    }]
            }]
    }];


var Process = React.createClass({
    render: function(){
        var children = this.props.proc.children.map(function(proc){
            return (<Process proc={proc} key={proc.id}/>);
        });
        if(children.length > 0){
            return (
                    <div className="process-block">
                        <div data-toggle="collapse" data-target={"#"+this.props.proc.id+"-body"} className="process-block-header">
                            {this.props.proc.exe}
                        </div>
                        <div id={this.props.proc.id+"-body"} className="collapse process-block-body">
                            {children}
                        </div>
                    </div>
                    );
        }else{
            return (
                    <div className="process-block">
                        <div className="process-block-header">
                            {this.props.proc.exe}
                        </div>
                    </div>
                    );
        }
    }
});


var SessionBlock = React.createClass({
    render: function(){
        var processes = this.props.session.processes.map(function(proc){
            return (<Process proc={proc} key={proc.id}/>);
        });
        return (
                <div className="session-block">
                    <div data-toggle="collapse" data-target={"#"+this.props.session.id+"-body"} className="session-block-header">
                        {this.props.session.ip}:{this.props.session.port}
                    </div>
                    <div id={this.props.session.id+"-body"} className="collapse session-block-body">
                        {processes}
                    </div>
                </div>
                );
    }
});


var ProvDisplay = React.createClass({
    render: function(){
        var sessions = this.props.data.map(function (session){
            return (<SessionBlock session={session} key={session.id}/>);
        });
        return (
                <div className="display-container">
                    {sessions}
                </div>
               );
    }
});

React.render(
    (<ProvDisplay data={data} />),
    document.getElementById('container')
    );
