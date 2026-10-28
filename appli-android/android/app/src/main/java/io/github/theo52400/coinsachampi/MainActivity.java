package io.github.theo52400.coinsachampi;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // module maison : alertes du groupe en notification, affichées tout de suite (voir AlertesPlugin)
        registerPlugin(AlertesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
